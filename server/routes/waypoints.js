import express from 'express';
import logger from 'winston';

// For reading and writing to config
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.post('/save/:filename', (req, res) => {
  const { filename } = req.params;

  logger.info(`Saving waypoints to file ${filename}.json`, req.body);

  // Make waypoint dir if its not there
  if (!fs.existsSync('waypoints')) {
    logger.info(`Making waypoint directory`);
    fs.mkdirSync('waypoints');
  }

  // Write out the file
  try {
    // Get filepath
    const filepath = path.resolve(`waypoints/${filename}`);
    // Write out file
    fs.writeFileSync(`${filepath}.json`, JSON.stringify(req.body, null, 2));
  } catch (err) {
    console.error(err);
  }

  return res.sendStatus(200);
});

router.get('/load/:filename', (req, res) => {
  const { filename } = req.params;

  logger.info(`Loading waypoints from file ${filename}.json`);

  // Read in config file ( create if it does not exist yet )
  try {
    // Get filepath
    const filepath = path.resolve(`waypoints/${filename}`);

    // Read in config file
    const data = JSON.parse(fs.readFileSync(`${filepath}.json`, 'utf8'));

    logger.info('Successfully read in file', data);

    return res.send(data);
  } catch (err) {
    console.error(err);
    return res.sendStatus(400);
  }
});

router.get('/all', (req, res) => {
  logger.info(`Loading all waypoints from /waypoints`);
  const allWaypoints = {};
  const directory = path.resolve('waypoints/');
  try {
    fs.readdirSync(directory).forEach(filename => {
        // get current file name
        const name = path.parse(filename).name;
        // get current file extension
        const ext = path.parse(filename).ext;
        // get current file path
        const filepath = path.resolve(directory, filename);
  
        // get information about the file
        const stat = fs.statSync(filepath);
        // check if the current path is a file or a folder
        const isFile = stat.isFile();
        // exclude folders
        if (isFile && ext === '.json') {
          const data = JSON.parse(fs.readFileSync(`${filepath}`, 'utf8'));
          allWaypoints[name] = data;
          }
    });
    return res.send(allWaypoints);
  } catch (err) {
    console.error(err);
    return res.sendStatus(400);
  }
});

export default router;
