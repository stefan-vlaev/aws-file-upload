const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES({ region: 'us-central-1' });
const moment = require('moment');

// Valid file extensions
const VALID_EXTENSIONS = ['.pdf', '.jpg', '.png'];

exports.handler = async (event) => {
    const body = JSON.parse(event.body);
    const { file } = body; // Assuming the file is base64-encoded
    const fileBuffer = Buffer.from(file, 'base64');
    const fileName = `file_${Date.now()}`;
    const fileExtension = '.jpg'; // You should validate the extension properly

    // Validate file extension
    if (!VALID_EXTENSIONS.includes(fileExtension)) {
        await sendErrorNotification();
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Invalid file type uploaded' }),
        };
    }

    // Store the file in S3
    const s3Params = {
        Bucket: 'your-upload-bucket',
        Key: `${fileName}${fileExtension}`,
        Body: fileBuffer,
        ContentType: 'application/octet-stream',
    };

    try {
        await s3.putObject(s3Params).promise();
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error uploading file to S3', error }),
        };
    }

    // Store metadata in DynamoDB
    const metadata = {
        TableName: 'FileMetadata',
        Item: {
            fileName,
            fileSize: fileBuffer.length,
            fileExtension,
            uploadDate: moment().toISOString(),
        },
    };

    try {
        await dynamoDB.put(metadata).promise();
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error storing metadata in DynamoDB', error }),
        };
    }

    // Send email notification via SES
    try {
        await sendEmailNotification(fileName, fileBuffer.length, fileExtension);
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Error sending email notification', error }),
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'File uploaded successfully' }),
    };
};

async function sendEmailNotification(fileName, fileSize, fileExtension) {
    const emailParams = {
        Source: 'your-email@example.com',
        Destination: {
            ToAddresses: ['hristo.zhelev@yahoo.com'],
        },
        Message: {
            Subject: {
                Data: 'File Upload Notification',
            },
            Body: {
                Text: {
                    Data: `File: ${fileName}\nSize: ${fileSize} bytes\nExtension: ${fileExtension}\nUpload Date: ${moment().toISOString()}`,
                },
            },
        },
    };

    await ses.sendEmail(emailParams).promise();
}

async function sendErrorNotification() {
    const emailParams = {
        Source: 'your-email@example.com',
        Destination: {
            ToAddresses: ['hristo.zhelev@yahoo.com'],
        },
        Message: {
            Subject: {
                Data: 'Invalid File Upload Attempt',
            },
            Body: {
                Text: {
                    Data: 'A file with an unsupported extension was uploaded.',
                },
            },
        },
    };

    await ses.sendEmail(emailParams).promise();
}
