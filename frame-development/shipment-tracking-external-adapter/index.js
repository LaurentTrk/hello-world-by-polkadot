const {Requester, Validator} = require('@chainlink/external-adapter')
const dotenv = require('dotenv');

dotenv.config();

const customError = (data) => {
  if (data.Response === 'Error') return true
  return false
}

let trackingNumbers = new Map()

const customParams = {
  trackingNumber: ['trackingNumber'],
}

const createRequest = (input, callback) => {

  const validator = new Validator(callback, input, customParams)
  const jobRunID = validator.validated.id
  const trackingNumber = validator.validated.data.trackingNumber

  if (trackingNumber === ''){
    const errorMessage = "Unknown trackingNumber "
    console.error(errorMessage)
    callback(500, Requester.errored(jobRunID, errorMessage))
  }

  let result = 0;
  console.log("trackingNumber = ", trackingNumber)
  if (trackingNumbers.has(trackingNumber)) {
    result = trackingNumbers.get(trackingNumber);
    result += 1
    if (result > 2){
      result = 2;
    }
    console.log("trackingValue", result)
  }
  trackingNumbers.set(trackingNumber, result)

  console.log("Result = ", result)
  const response = {
    jobRunID: jobRunID,
    data: { result: result, trackingNumber: trackingNumber},
    result: result,
    statusCode: 200
  }
  callback(200, response);
}

// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

// This allows the function to be exported for testing
// or for running in express
module.exports.createRequest = createRequest
