import * as fs from 'fs'
import * as Path from 'path'
import * as Promise from 'bluebird'

const fsReadDir = Promise.promisify(fs.readdir);
const fsStat = Promise.promisify(fs.stat);

let walker = (dirName, blacklist) => {
  if (blacklist.indexOf(dirName) !== -1)
    return false;

  return fsReadDir(dirName).map(fileName => { // for each file we take it
    var path = Path.join(dirName, fileName); // get the correct path

    return fsStat(path)
      .then(stat => stat.isDirectory() ? walker(path, blacklist) : path);
  })
  .filter(a => a)
  .reduce((a, b) => a.concat(b), []);
};

export default walker;
