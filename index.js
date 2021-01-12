const streamify = require('stream-array');
const archiver = require('archiver');
const AWS = require('aws-sdk');

class S3zipper {
  constructor({ s3, accessKeyId, secretAccessKey, region, bucket, debug }) {
    if (s3) {
      this.s3 = s3;
      this.bucket = bucket;
      this.debug = debug || false;
    } else {
      this.accessKeyId = accessKeyId;
      this.secretAccessKey = secretAccessKey;
      this.region = region;
      this.bucket = bucket;
      this.debug = debug || false;

      AWS.config.update({
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        region: this.region,
      });

      this.s3 = new AWS.S3();
    }
  }

  archive = (files) => {
    const keyStream = this.filesKeyStream(files);
    return this.archiveStream(keyStream);
  };

  filesKeyStream = (keys)  => {
    if (!keys) return null;
    let files = [];

    const getUniqueName = (name, folder) => {
      const equal = files.filter(file => file.shadowName === name && folder === file.folder);
      if (!equal || !equal.length) return name;
      const nameSplit = name.split('.')
      const firstPart = nameSplit.slice(0, nameSplit.length - 1).join('.')
      return `${firstPart}(${equal.length}).${nameSplit[nameSplit.length - 1]}`;
    }

    keys.forEach((currKey) => {
      if(typeof currKey === 'object') {
        const splitKey = currKey.key.split('/');
        const name = currKey.name
          ? currKey.name
          : splitKey.length > 1 ? splitKey[splitKey.length - 1] : currKey.key

        const folder = currKey.folder || ''
        files.push({ key: currKey.key, folder, name: getUniqueName(name, folder), shadowName: name })
      } else {
        const splitKey = currKey.split('/');
        if (splitKey.length > 1) {
          files.push({
            key: currKey,
            folder: '',
            name: splitKey[splitKey.length - 1],
            shadowName: splitKey[splitKey.length - 1],
          });
        } else {
          files.push({ key: currKey, folder: '', name: currKey, shadowName: currKey });
        }
      }
    });
    return streamify(files);
  };

  archiveStream = (keyStream) => {
    // if (this.registerFormat) {
    //   archiver.registerFormat(this.registerFormat, this.formatModule)
    // }
    const archive = archiver(this.format || 'zip', this.archiverOpts || {});
    archive.on('error', function (err) {
      this.debug && console.log('archive error', err);
    });

    let fileCounter = 0;
    keyStream
      .on('data', (currKey) => {
        fileCounter += 1;
        this.debug && console.log('-> start stream [file]:', currKey.key);

        const params = { Bucket: this.bucket, Key: currKey.key };
        const s3File = this.s3.getObject(params).createReadStream();

        s3File.on('end', () => {
          this.debug && console.log('-> finalize archive [file]:', currKey.key);
          fileCounter -= 1;

          if (fileCounter < 1) {
            this.debug && console.log('-> finalize all');
          }
        });

        s3File.on('error', (err) => {
          this.debug && console.log('S3 error:');
          this.debug && console.log(err);
          archive.emit('error', err)
        });

        archive.append(s3File, { name: currKey.name, prefix: currKey.folder });
      })

      .on('end', function () {
        archive.finalize();
      })
      .on('error', function (err) {
        archive.emit('error', err);
      });

    return archive;
  };

  setFormat = (format) => {
    this.format = format;
    return this;
  };

  setArchiverOptions = (archiverOpts) =>  {
    this.archiverOpts = archiverOpts;
    return this;
  };
}

module.exports = S3zipper;
