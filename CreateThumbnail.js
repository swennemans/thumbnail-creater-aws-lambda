// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var gm = require('gm').subClass({imageMagick: true}); // Enable ImageMagick integration.
var util = require('util');

// constants
var MAX_WIDTH = 50;
var MAX_HEIGHT = 50;

var MAX_WIDTH_SM = 150;
var MAX_HEIGHT_SM = 150;

var MAX_HEIGHT_MD = 250;
var MAX_WIDTH_MD = 250;

var MAX_HEIGHT_LG = 500;
var MAX_WIDTH_LG = 500;

// get reference to S3 client
var s3 = new AWS.S3();

exports.handler = function (event, context) {
    // Read options from the event.
    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));
    var srcBucket = event.Records[0].s3.bucket.name;
    // Object key may have spaces or unicode non-ASCII characters.
    var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    var dstBucket = srcBucket + "-thumbs";

    // Sanity check: validate that source and destination are different buckets.
    if (srcBucket == dstBucket) {
        console.error("Destination bucket must not match source bucket.");
        return;
    }

    // Infer the image type.
    var typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        console.error('unable to infer image type for key ' + srcKey);
        return;
    }
    var imageType = typeMatch[1];
    if (imageType != "jpg" && imageType != "png") {
        console.log('skipping non-image ' + srcKey);
        return;
    }

    // Download the image from S3, transform, and upload to a different S3 bucket.
    async.waterfall([
            function download(callback) {
                // Download the image from S3 into a buffer.
                s3.getObject({
                    Bucket: srcBucket,
                    Key: srcKey
                }, function (err, res) {
                    callback(null, res)
                });
            },
            function transform(response, callback) {
                console.log('transform is called', response);

                async.parallel({
                    xs: function (callback) {
                        gm(response.Body).size(function (err, size) {
                            // Infer the scaling factor to avoid stretching the image unnaturally.
                            var scalingFactor = Math.min(
                                MAX_WIDTH / size.width,
                                MAX_HEIGHT / size.height
                            );
                            var width = scalingFactor * size.width;
                            var height = scalingFactor * size.height;

                            // Transform the image buffer in memory.
                            this.resize(width, height)
                                .toBuffer(imageType, function (err, buffer) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback(null, response.ContentType, buffer);
                                    }
                                });
                        });
                    },
                    sm: function (callback) {
                        gm(response.Body).size(function (err, size) {
                            // Infer the scaling factor to avoid stretching the image unnaturally.
                            var scalingFactor = Math.min(
                                MAX_WIDTH_SM / size.width,
                                MAX_HEIGHT_SM / size.height
                            );
                            var width = scalingFactor * size.width;
                            var height = scalingFactor * size.height;

                            // Transform the image buffer in memory.
                            this.resize(width, height)
                                .toBuffer(imageType, function (err, buffer) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback(null, response.ContentType, buffer);
                                    }
                                });
                        });
                    },
                    md: function (callback) {
                        gm(response.Body).size(function (err, size) {
                            // Infer the scaling factor to avoid stretching the image unnaturally.
                            var scalingFactor = Math.min(
                                MAX_WIDTH_MD / size.width,
                                MAX_HEIGHT_MD / size.height
                            );
                            var width = scalingFactor * size.width;
                            var height = scalingFactor * size.height;

                            // Transform the image buffer in memory.
                            this.resize(width, height)
                                .toBuffer(imageType, function (err, buffer) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback(null, response.ContentType, buffer);
                                    }
                                });
                        });
                    },
                    lg: function (callback) {
                        gm(response.Body).size(function (err, size) {
                            // Infer the scaling factor to avoid stretching the image unnaturally.
                            var scalingFactor = Math.min(
                                MAX_WIDTH_LG / size.width,
                                MAX_HEIGHT_LG / size.height
                            );
                            var width = scalingFactor * size.width;
                            var height = scalingFactor * size.height;

                            // Transform the image buffer in memory.
                            this.resize(width, height)
                                .toBuffer(imageType, function (err, buffer) {
                                    if (err) {
                                        callback(err);
                                    } else {
                                        callback(null, response.ContentType, buffer);
                                    }
                                });
                        });
                    }
                }, function (err, results) {
                    if (err) throw err;
                    else {
                        //go to upload()
                        callback(null, results);
                    }
                });
            },
            function upload(results, callback) {
                //loop over objects in results with async.forEachOf and transfer to s3 bucket;
                async.forEachOf(results, function(value, key, callback) {
                    var imgBody = value[1];
                    var imgType = value[0];
                    s3.putObject({
                        Bucket: dstBucket,
                        Key:  key + "-" +srcKey,
                        Body: imgBody,
                        ContentType: imgType
                    }, function (err, res) {
                        if (err) {
                            console.log('error is', err);
                            throw err;
                        }
                        else {
                            console.log('Resp is', res);
                            callback(null);
                        }
                    });
                }, function(err) {
                    console.log('complete!');
                    callback(null);
                });
            }
        ], function (err) {
            if (err) {
                console.error(
                    'Unable to resize ' + srcBucket + '/' + srcKey +
                    ' and upload to ' + dstBucket + '/' + srcKey +
                    ' due to an error: ' + err
                );
            } else {
                console.log(
                    'Successfully resized + uploaded'
                );
            }
            context.done();
        }
    );
};
