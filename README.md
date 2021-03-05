# S3 stream zipper

[![npm version](https://badge.fury.io/js/s3-stream-zipper.svg)](https://badge.fury.io/js/s3-stream-zipper)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/andreizanik/s3-stream-zipper.svg)

Allows to download and archive large amounts of data from AWS S3.
Unlike similar solutions, it does not save downloaded files entirely in RAM and on disk. Files are downloaded in a stream in parts and immediately archived.

`.archive(files)` returns Stream

## Installation
```
npm i s3-stream-zipper
```

## Usage
```
  const files = [
    'video.mp4',
    'fileName.mkv',
    'folder/3.jpeg',
    { key: '6.jpeg' },
    { key: 'folder/6.jpeg' },
    { key: 'folder/6.jpeg' name: 'img6.jpeg' },
    { key: 'folder/7.jpeg' name: 'img7.jpeg', folder: 'images' },
  ];

  const s3zipper = new S3zipper({
   accessKeyId: 'ACCESS_KEY',
   secretAccessKey: 'SECRE_ACCESS_KEY',
   region: 'eu-central-1',
   bucket: 'bucket-test',
  });

  const zipperStream = s3zipper.archive(files);
```

#### Stream to file
```
  const s3zipper = new S3zipper({
    accessKeyId: 'ACCESS_KEY',
    secretAccessKey: 'SECRE_ACCESS_KEY',
    region: 'eu-central-1',
    bucket: 'bucket-test',
  });

  const output = await fs.createWriteStream(join(__dirname, `use-${Date.now()}.zip`));

  s3zipper
    .archive(files)
    .pipe(output);
```

#### usage s3 in config

```
  AWS.config.update({
    accessKeyId: 'ACCESS_KEY',
    secretAccessKey: 'SECRE_ACCESS_KEY',
    region: 'eu-central-1',
  });

  const s3 = new AWS.S3();
  const s3zipper = new S3zipper({
    s3,
    bucket: 'bucket-test',
    debug: true
  });

  const zipperStream = s3zipper.archive(files);
```

#### Stream to s3

```
  AWS.config.update({
    accessKeyId: 'ACCESS_KEY',
     secretAccessKey: 'SECRE_ACCESS_KEY',
     region: 'eu-central-1',
  });

  const s3 = new AWS.S3();
  const s3zipper = new S3zipper({
    s3,
    bucket: 'bucket-test',
    debug: true
  });

  const zipperStream = s3zipper.archive(files);

  const params = { Bucket: 'bucket-test', Key: `archives/${Date.now()}.zip`, Body: zipperStream };
  s3.upload(params)
    .on('httpUploadProgress', function (evt) { console.log(evt) })
    .send(function (e, r) {
      if (e) {
        const err = 'zipFile.upload error ' + e;
        console.log(err)
      }
      console.log(r)
    });
```
