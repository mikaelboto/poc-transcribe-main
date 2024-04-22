// Import the required AWS SDK clients and commands for Node.js
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const region = 'us-east-1'
const transcribeClient = new TranscribeClient({ region });
const s3Client = new S3Client({region})

const outputBucket = "xxxxxxx-output"

export async function handler (event, context) {
  console.log('event', event)
  const body = JSON.parse(event.body)
  const mediaFileUri = body.s3URL

  console.time('Transcribe')
  const transcribedText = await transcribe(mediaFileUri)
  console.timeEnd('Transcribe')

  return {
    statusCode: 200,
    body: JSON.parse({
      transcribedText: transcribedText,
    })
  }
}


async function transcribe(mediaFileUri){
  try {
    console.log("Starting Transcribe Job...")

    const fileName = `teste-${Date.now().toString()}`

    const startJobResponse = await transcribeClient.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: fileName,
        LanguageCode: "pt-BR", // For example, 'en-US'
        MediaFormat: "ogg", // For example, 'wav'
        Media: {
          MediaFileUri: mediaFileUri,
        },
        OutputBucketName: outputBucket
      })
    );

    console.log("startJobResponse", startJobResponse);
    
    const jobName = startJobResponse.TranscriptionJob.TranscriptionJobName
    
    let maxTries = 60

    while(maxTries > 0){
        maxTries -= 1

        const getJobResponse = await transcribeClient.send(new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName
        }))
       
        const status = getJobResponse.TranscriptionJob.TranscriptionJobStatus

        if (status === 'COMPLETED' || status === 'FAILED'){
          // console.log(`Job ${jobName} is ${status}.`)

          console.log(`...`)

          const key = `${fileName}.json`
          if(status == "COMPLETED"){
            const getObjectResponse = await s3Client.send(new GetObjectCommand({
                Bucket: outputBucket,
                Key: key
            }))
            const bodyString = await getObjectResponse.Body.transformToString()

            const transcribeResponse = JSON.parse(bodyString)
            console.log(transcribeResponse)

            const transcribedText = transcribeResponse.results.transcripts[0].transcript
            console.log(transcribedText)

            return transcribedText
          }

          break
        } else{
          console.log(`Waiting for ${jobName}. Current status is ${status}.`)
          await sleep(500)
        }
      }
      return null


  } catch (err) {
    console.log("Error", err);
  }
};

async function sleep(ms){
  return new Promise((res, rej) => {
    setTimeout(()=>{
      res()
    }, ms)
  })
}
