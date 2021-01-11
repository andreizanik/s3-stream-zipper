const streamify = require('stream-array');
const archiver = require('archiver');
const AWS = require('aws-sdk');

class S3zipper {
  constructor({ accessKeyId, secretAccessKey, region, bucket, debug }) {
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

  archive = (files) => {
    const keyStream = this.filesKeyStream(files);
    return this.archiveStream(keyStream);
  };

  filesKeyStream = (keys)  => {
    if (!keys) return null;
    let paths = [];

    keys.forEach((key) => {
      if(typeof key === 'object') {
        paths.push({ file: key.file, folder: key.folder || '', fullPath: `${key.folder || ''}${key.file}` })
      } else {
        const splitKey = key.split('/');
        if (splitKey.length > 1) {
          paths.push({
            file: splitKey[splitKey.length - 1],
            folder: splitKey.slice(0, splitKey.length - 1).join('/') + '/',
            fullPath: key,
          });
        } else {
          paths.push({ file: key, folder: '', fullPath: key });
        }
      }
    });
    return streamify(paths);
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
      .on('data', (key) => {
        fileCounter += 1;
        this.debug && console.log('-> start stream [file]:', key.fullPath);

        const params = { Bucket: this.bucket, Key: key.fullPath };
        const s3File = this.s3.getObject(params).createReadStream();

        s3File.on('end', () => {
          this.debug && console.log('-> finalize archive [file]:', key.fullPath);
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

        archive.append(s3File, { name: key.file, prefix: key.folder });
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
