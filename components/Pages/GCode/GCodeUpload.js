import React, { useState, useCallback } from 'react';
import { Button, TextField, TableView, TableHeader, TableBody, Row, Cell, ProgressBar, Column } from '@adobe/react-spectrum';

function GCodeYukleme() {
  const [gcode, setGcode] = useState(null);
  const [gcodeContent, setGcodeContent] = useState('');
  const [progress, setProgress] = useState(0);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setGcodeContent(e.target.result);
        setProgress(100); // Yükleme tamamlandı
      };
      reader.readAsText(file);
      setProgress(50); // Yükleme başlamadan önce
    }
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px' }}>
      <div style={{ width: '45%' }}>
        <h2>GCODE YÜKLEME KISMI</h2>
        <TextField 
          label="Gcode Dosyasını Seçin"
          type="file"
          onChange={handleFileUpload}
          accept=".gcode,.txt"
        />
        <ProgressBar value={progress} maxValue={100} label={`${progress}%`} />
      </div>

      <div style={{ width: '45%' }}>
        <h2>GCODE İçeriği</h2>
        <TableView aria-label="GCode İçeriği" width="100%" maxWidth="100%">
          <TableHeader>
            <Column>Satır</Column>
            <Column>GCode</Column>
          </TableHeader>
          <TableBody>
            {gcodeContent.split('\n').map((line, index) => (
              <Row key={index}>
                <Cell>{index + 1}</Cell>
                <Cell>{line}</Cell>
              </Row>
            ))}
          </TableBody>
        </TableView>
      </div>
    </div>
  );
}

export default GCodeYukleme;