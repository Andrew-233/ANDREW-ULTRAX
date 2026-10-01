const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const { tmpdir } = require('os');
const path = require('path');

const { createFakeContact } = require('../lib/fakeContact');
async function toAudioCommand(sock, chatId, message) {
  let inputPath = '';
  let outputPath = '';
  
  try {
    // Get the media message with better validation
    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let msg = null;
    
    // Check quoted message first
    if (quotedMsg) {
      msg = quotedMsg.videoMessage || quotedMsg.audioMessage || quotedMsg.documentMessage;
    } else {
      // Check direct message
      msg = message.message?.videoMessage || message.message?.audioMessage || message.message?.documentMessage;
    }

    if (!msg) {
      await sock.sendMessage(chatId, { 
        text: "🎧 Reply to a *video* or *audio* file to convert it to audio!" 
      },{ quoted: createFakeContact(message) });
      return;
    }

    // Better MIME type checking
    const mime = msg.mimetype || '';
    const isVideo = mime.startsWith('video/');
    const isAudio = mime.startsWith('audio/');
    const isDocument = msg.documentMessage && (
      mime.includes('video') || 
      mime.includes('audio') || 
      mime.includes('mp4') || 
      mime.includes('mpeg')
    );

    if (!isVideo && !isAudio && !isDocument) {
      await sock.sendMessage(chatId, { 
        text: "⚠️ Only works on *video* or *audio* messages!" 
      },{ quoted: createFakeContact(message) });
      return;
    }

    await sock.sendMessage(chatId, { text: "🎶 Converting to audio..." },{ quoted: createFakeContact(message) });

    // Determine file type for download
    const fileType = isVideo ? 'video' : 'audio';
    
    // Download media with proper error handling
    let stream;
    try {
      stream = await downloadContentFromMessage(msg, fileType);
    } catch (downloadErr) {
      console.error('Download error:', downloadErr);
      throw new Error(`Failed to download media: ${downloadErr.message}`);
    }

    // Temp paths with proper extensions
    const tempDir = tmpdir();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    
    // Use original extension or default to mp4 for videos
    const inputExt = mime.includes('mp4') ? 'mp4' : 
                     mime.includes('webm') ? 'webm' : 
                     mime.includes('ogg') ? 'ogg' : 
                     isVideo ? 'mp4' : 'temp';
    
    inputPath = path.join(tempDir, `input_${timestamp}_${random}.${inputExt}`);
    outputPath = path.join(tempDir, `output_${timestamp}_${random}.mp3`);
    
    // Write file in chunks to avoid memory issues
    const writeStream = require('fs').createWriteStream(inputPath);
    
    await new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        writeStream.write(chunk);
      });
      
      stream.on('end', () => {
        writeStream.end();
        resolve();
      });
      
      stream.on('error', (err) => {
        writeStream.end();
        reject(err);
      });
      
      writeStream.on('error', reject);
    });

    // Verify file exists and has content
    const stats = await fs.stat(inputPath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    // Convert using ffmpeg with better options
    await new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .audioChannels(2) // Stereo
        .audioFrequency(44100) // Standard frequency
        .on('start', (commandLine) => {
          console.log('FFmpeg command:', commandLine);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Processing: ${Math.round(progress.percent)}% done`);
          }
        })
        .on('end', () => {
          console.log('Conversion completed successfully');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error details:', {
            message: err.message,
            code: err.code,
            signal: err.signal
          });
          reject(new Error(`FFmpeg failed: ${err.message}`));
        })
        .save(outputPath);

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (command && command.ffmpegProc && !command.ffmpegProc.killed) {
          console.log('FFmpeg timeout reached, killing process');
          command.kill('SIGKILL');
          reject(new Error('Conversion timeout (60 seconds)'));
        }
      }, 60000); // 60 second timeout
    });

    // Read converted audio file
    const audioStats = await fs.stat(outputPath);
    if (audioStats.size === 0) {
      throw new Error('Converted audio file is empty');
    }

    const audioBuffer = await fs.readFile(outputPath);
    
    // Check file size limits (WhatsApp has ~16MB limit for audio)
    const maxSize = 15 * 1024 * 1024; // 15MB
    if (audioBuffer.length > maxSize) {
      console.warn(`Audio file too large: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      // You could add compression here if needed
    }

    // Send converted audio
    await sock.sendMessage(chatId, { 
      audio: audioBuffer, 
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `converted_${timestamp}.mp3`
    }, { quoted: createFakeContact(message) });

  } catch (err) {
    console.error("❌ toAudio error:", {
      error: err.message,
      stack: err.stack,
      inputPath,
      outputPath
    });
    
    let errorMessage = "💥 Failed to convert media to audio.\n";
    
    if (err.message.includes('FFmpeg') || err.message.includes('conversion')) {
      errorMessage += "FFmpeg error. Please ensure:\n";
      errorMessage += "• FFmpeg is installed on your system\n";
      errorMessage += "• The media file is not corrupted\n";
      errorMessage += "• File format is supported (MP4, WEBM, MP3, etc.)";
    } else if (err.message.includes('timeout')) {
      errorMessage += "Conversion took too long. Try a shorter video.";
    } else if (err.message.includes('empty')) {
      errorMessage += "The file appears to be empty or invalid.";
    } else if (err.message.includes('download')) {
      errorMessage += "Could not download the media file.";
    } else {
      errorMessage += `Error: ${err.message}`;
    }
    
    await sock.sendMessage(chatId, { text: errorMessage },{ quoted: createFakeContact(message) });
    
  } finally {
    // Cleanup temp files with better error handling
    const cleanupPromises = [];
    
    if (inputPath) {
      cleanupPromises.push(
        fs.unlink(inputPath).catch(err => 
          console.error(`Failed to delete ${inputPath}:`, err.message)
        )
      );
    }
    
    if (outputPath) {
      cleanupPromises.push(
        fs.unlink(outputPath).catch(err => 
          console.error(`Failed to delete ${outputPath}:`, err.message)
        )
      );
    }
    
    await Promise.allSettled(cleanupPromises);
  }
}

module.exports = toAudioCommand;
