import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RobotControllerContext,
  RobotStateContext,
  RobotMetaContext,
  RobotKinimaticsContext,
} from '../context/RobotContext';
import io from 'socket.io-client';
import useApp from '../hooks/useApp';
import { useFieldState, useFormApi } from 'informed';
import { toRadians } from '../../lib/toRadians';
import { inverse as inverseBasic } from 'kinematics-js';
import { inverse as inverseUR } from '../../lib/inverse_UR';
import { toDeg } from '../../lib/toDeg';
import { forward } from 'kinematics-js';
import { debounce } from '../utils/debounce';

const RobotProvider = ({ children }) => {
  const { socket, config } = useApp();
  const formApi = useFormApi();

  const [robots, setRobots] = useState({});
  const [robotStates, setRobotStates] = useState({});
  const robotStatesRef = useRef();
  robotStatesRef.current = robotStates;

  const [connected, setConnected] = useState(false);
  const connectedRef = useRef();
  connectedRef.current = connected;

  const [endPosition, setEndPosition] = useState({ x: 0, y: 0, z: 0 });
  const { value: robotId } = useFieldState('robotId');
  const setBallRef = useRef();

  useEffect(() => {
    const robotsHandler = (rbts) => {
      setRobots(rbts);
    };

    const stateHandler = (id, robotState) => {
      setRobotStates((prev) => ({ ...prev, [id]: robotState }));
    };

    const connectedHandler = (id) => {
      if (id == formApi.getFormState().values.robotId) {
        formApi.setError('robotId', undefined);
        formApi.setError('motorId', undefined);
        setConnected(true);
      }
    };

    const disconnectedHandler = (id) => {
      if (id == formApi.getFormState().values.robotId) {
        formApi.setError('robotId', 'Disconnected');
        formApi.setError('motorId', 'Disconnected');
        setConnected(false);
      }
    };

    socket.on('robot', stateHandler);
    socket.on('robots', robotsHandler);
    socket.on('robotConnected', connectedHandler);
    socket.on('robotDisconnected', disconnectedHandler);

    return () => {
      socket.removeListener('robot', stateHandler);
      socket.removeListener('robots', robotsHandler);
      socket.removeListener('robotConnected', connectedHandler);
      socket.removeListener('robotDisconnected', disconnectedHandler);
    };
  }, []);

  useEffect(() => {
    const robotId = formApi.getValue('robotId') || '1';
    socket.emit('register', {
      id: robotId,
      key: 'default',
      robotType: 'IgusRebel',
      motors: {
        j0: { id: 'j0' },
        j1: { id: 'j1' },
        j2: { id: 'j2' },
        j3: { id: 'j3' },
      },
    });
  }, []);

  useEffect(() => {
    if (Object.keys(robots).find((id) => id == robotId)) {
      setConnected(true);
    } else {
      setConnected(false);
    }
  }, [robotId, robots]);

  const robotOptions = useMemo(() => {
    return Object.values(robots).map((robot) => ({
      value: robot.id,
      label: `${robot.id}`,
    }));
  }, [robots]);

  const value = { robots, robotStates, robotOptions, connected };

  const meta = useMemo(() => {
    const getRobotState = (robotId) => robotStatesRef.current[robotId];
    return { robots, robotOptions, connected, getRobotState };
  }, [robots, robotOptions, connected]);

  const updateJoint = useCallback((motorId, value) => {
    const { runOnRobot } = formApi.getFormState().values;
    if (connectedRef.current && runOnRobot) {
      const robotId = formApi.getValue('robotId');
      socket.emit('motorSetPos', robotId, motorId, value);
    }
  }, []);

  const updateGripper = useCallback((value, speed, force) => {
    formApi.setValue('gripper', value);
    if (connectedRef.current) {
      const robotId = formApi.getValue('robotId');
      socket.emit('gripperSetPos', robotId, value, speed, force);
    }
  }, []);

  const updateConfig = useCallback((key, value) => {
    if (connectedRef.current) {
      const robotId = formApi.getValue('robotId');
      socket.emit('robotUpdateConfig', robotId, key, value);
    }
  }, []);

  const saveConfig = useCallback(() => {
    if (connectedRef.current) {
      const robotId = formApi.getValue('robotId');
      socket.emit('robotWriteConfig', robotId);
    }
  }, []);

  const updateForward = () => {
    const { j0, j1, j2, j3, base, v0, v1, v2, v3, x0, endEffector } =
      formApi.getFormState().values;

    const robotConfig = {
      base,
      v1: v0,
      v2: v1,
      v3: v2,
      v4: v3,
      v5: 0,
      v6: 0 + endEffector,
      x0,
    };

    const res = forward(
      toRadians(j0),
      toRadians(j1),
      toRadians(j2),
      toRadians(j3),
      0,
      0,
      robotConfig
    );

    const x = res[0][3];
    const y = res[1][3];
    const z = res[2][3];
    setEndPosition({ x, y, z });
  };

  const debouncedUpdateForward = useMemo(() => debounce(updateForward), []);

  const configRef = useRef();
  configRef.current = config;

  const updateRobot = useCallback((x, y, z, r1, r2, r3, speed) => {
    const { base, v0, v1, v2, v3, x0, y0, runOnRobot, endEffector } =
      formApi.getFormState().values;

    const ro1 = toRadians(r1);
    const ro2 = toRadians(r2);
    const ro3 = toRadians(r3);

    const inverse = configRef.current.inverseType === 'UR' ? inverseUR : inverseBasic;

    const angles = inverse(x, y, z, ro1, ro2, ro3, {
      base,
      v1: v0,
      v2: v1,
      v3: v2,
      v4: v3,
      v5: 0,
      v6: 0 + endEffector,
      x0,
      y0,
      flip: configRef.current.flip,
      adjustments: configRef.current.adjustments,
    });

    if (!angles.find((a) => isNaN(a))) {
      const valuesToSet = {
        j0: toDeg(angles[0]),
        j1: toDeg(angles[1]),
        j2: toDeg(angles[2]),
        j3: toDeg(angles[3]),
        x, y, z, r1, r2, r3,
      };

      formApi.setTheseValues(valuesToSet);

      if (connectedRef.current && runOnRobot) {
        const robotId = formApi.getValue('robotId');

        socket.emit('robotSetAngles', robotId, angles.slice(0, 4).map(toDeg),speed); // sadece j0-j3      
      }

      debouncedUpdateForward();
    }
  }, []);

  const updateJoints = useCallback((angles, speed) => {
    const { runOnRobot } = formApi.getFormState().values;

    if (!angles.find((a) => isNaN(a))) {
      const updatedValues = {};
      for (let i = 0; i < angles.length; i++) {
        updatedValues[`j${i}`] = angles[i];
      }

      formApi.setTheseValues(updatedValues);

      if (connectedRef.current && runOnRobot) {
        const robotId = formApi.getValue('robotId');
        socket.emit('robotSetAngles', robotId, angles,speed);
      }

      debouncedUpdateForward();
    }
  }, []);

  const robotController = useMemo(() => ({
    updateGripper,
    updateJoint,
    updateRobot,
    updateConfig,
    saveConfig,
    setBallRef,
    updateJoints,
  }), []);

  const kinimatics = useMemo(() => ({
    endPosition,
    updateForward: debouncedUpdateForward,
  }), [endPosition, debouncedUpdateForward]);

  return (
    <RobotControllerContext.Provider value={robotController}>
      <RobotMetaContext.Provider value={meta}>
        <RobotKinimaticsContext.Provider value={kinimatics}>
          <RobotStateContext.Provider value={value}>
            {children}
          </RobotStateContext.Provider>
        </RobotKinimaticsContext.Provider>
      </RobotMetaContext.Provider>
    </RobotControllerContext.Provider>
  );
};

export default RobotProvider;
