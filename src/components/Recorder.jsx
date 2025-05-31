import React, { useRef, useState, useEffect } from 'react';
import { generateGPX } from '../utils/gpxHelper'; // Helper to generate GPX file from GPS data
import '../styles/recorder.css';
import { saveAs } from 'file-saver'; // For downloading files
import JSZip from 'jszip'; // For zipping files

const Recorder = () => {
  // State hooks
  const [recording, setRecording] = useState(false);
  const [mediaBlobUrl, setMediaBlobUrl] = useState(null); // URL for video preview
  const [locations, setLocations] = useState([]); // GPS track log
  const [photos, setPhotos] = useState([]); // Array of captured photos with metadata
  const [captureMessage, setCaptureMessage] = useState(''); // UI message for photo capture

  // Refs for storing media and geolocation handlers
  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const streamRef = useRef(null);
  const locationWatchId = useRef(null);
  const videoPreviewRef = useRef(null);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, []);

  // Start recording video and location
  const startRecording = async () => {
    navigator.geolocation.getCurrentPosition(
      async () => {
        try {
          // Get access to rear camera
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });

          streamRef.current = stream;

          // Attach stream to video element
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.onloadedmetadata = () => {
              videoPreviewRef.current.play().catch((error) => {
                console.warn('Video play was prevented:', error);
              });
            };
          }

          // Set up media recorder
          mediaRecorderRef.current = new MediaRecorder(stream);
          recordedChunks.current = [];

          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunks.current.push(event.data);
            }
          };

          mediaRecorderRef.current.onstop = () => {
            const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
            setMediaBlobUrl(URL.createObjectURL(blob));
          };

          mediaRecorderRef.current.start();
          setRecording(true);
          setLocations([]);
          setPhotos([]);

          // Watch geolocation changes
          locationWatchId.current = navigator.geolocation.watchPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              const timestamp = new Date().toISOString();
              setLocations((prev) => {
                const last = prev[prev.length - 1];
                // Avoid duplicates
                if (!last || last.lat !== latitude || last.lon !== longitude) {
                  return [...prev, { lat: latitude, lon: longitude, time: timestamp }];
                }
                return prev;
              });
            },
            (error) => {
              console.warn('Geolocation error:', error);
            },
            {
              enableHighAccuracy: true,
              maximumAge: 0,
              timeout: 5000,
            }
          );
        } catch (err) {
          console.error('Media device error:', err);
          alert('Please allow camera access and use HTTPS.');
        }
      },
      (error) => {
        console.error('Location error:', error);
        alert('Location access is required to record.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  // Stop recording and clean up
  const stopRecording = () => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
          const blobUrl = URL.createObjectURL(blob);
          setMediaBlobUrl(blobUrl);
          resolve(blob);
        };
        mediaRecorderRef.current.stop();
      } else {
        resolve(null);
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
        locationWatchId.current = null;
      }

      setRecording(false);
    });
  };

  // Capture a photo from live preview
  const capturePhoto = () => {
    if (!videoPreviewRef.current) return;

    setCaptureMessage('Photo captured!');
    setTimeout(() => setCaptureMessage(''), 2000);

    // Create a canvas to draw frame
    const canvas = document.createElement('canvas');
    canvas.width = videoPreviewRef.current.videoWidth || 300;
    canvas.height = videoPreviewRef.current.videoHeight || 200;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoPreviewRef.current, 0, 0, canvas.width, canvas.height);

    // Get GPS location and annotate photo
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const timestamp = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // Add annotation
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, canvas.height - 60, canvas.width - 20, 50);
        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.fillText(`Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`, 20, canvas.height - 35);
        ctx.fillText(`Time (IST): ${timestamp}`, 20, canvas.height - 15);

        const imageData = canvas.toDataURL('image/jpeg');

        setPhotos((prev) => [
          ...prev,
          { image: imageData, lat: latitude, lon: longitude, time: timestamp },
        ]);
      },
      (error) => {
        console.warn('Photo GPS error:', error);
        const imageData = canvas.toDataURL('image/jpeg');
        setPhotos((prev) => [...prev, { image: imageData, lat: null, lon: null, time: 'Unknown' }]);
      }
    );
  };

  // Download all recorded data as a ZIP file
  const saveFiles = async () => {
    let videoBlob;

    if (!mediaBlobUrl) {
      videoBlob = await stopRecording();
    } else {
      videoBlob = new Blob(recordedChunks.current, { type: 'video/webm' });
    }

    if (!videoBlob) {
      alert('No video recorded!');
      return;
    }

    // Generate GPX file
    const gpx = generateGPX(locations);
    const gpxBlob = new Blob([gpx], { type: 'application/gpx+xml' });

    const zip = new JSZip();
    zip.file('pothole_video.mp4', videoBlob); // Save video
    zip.file('pothole_locations.gpx', gpxBlob); // Save GPS track

    // Save annotated photos
    photos.forEach((photo, index) => {
      const base64 = photo.image.split(',')[1];
      const latStr = photo.lat !== null ? photo.lat.toFixed(4) : 'unknownLat';
      const lonStr = photo.lon !== null ? photo.lon.toFixed(4) : 'unknownLon';
      const filename = `photo_${index + 1}_${latStr}_${lonStr}.jpg`;
      zip.file(filename, base64, { base64: true });
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'pothole_report.zip'); // Trigger download
  };

  // Reset UI and state
  const reset = () => {
    setMediaBlobUrl(null);
    setLocations([]);
    setPhotos([]);
    recordedChunks.current = [];
    setCaptureMessage('');
  };

  return (
    <div className="recorder-container" style={{ position: 'relative' }}>
      {/* Live preview */}
      <video
        ref={videoPreviewRef}
        width="100%"
        muted
        autoPlay
        playsInline
        className={`live-preview ${!recording ? 'hidden' : ''}`}
        style={{ display: recording ? 'block' : 'none', maxWidth: '100%' }}
      />

      <h2>{recording ? 'Recording...' : 'Record Pothole'}</h2>

      {/* Record/Stop button */}
      <button className={`record-btn ${recording ? 'stop' : 'start'}`} onClick={recording ? stopRecording : startRecording}>
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>

      {/* Capture photo button */}
      {recording && (
        <button className="photo-btn" onClick={capturePhoto}>
          Click Photo
        </button>
      )}

      {/* Temporary photo capture message */}
      {captureMessage && (
        <div
          style={{
            position: 'absolute',
            top: '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '8px 15px',
            borderRadius: '5px',
            zIndex: 100,
            fontWeight: 'bold',
            pointerEvents: 'none',
          }}
        >
          {captureMessage}
        </div>
      )}

      {/* Video playback after recording */}
      {mediaBlobUrl && (
        <div className="preview-section">
          <video src={mediaBlobUrl} controls width="100%" />
          <div className="action-buttons">
            <button className="save-btn" onClick={saveFiles}>
              Download
            </button>
            <button className="reset-btn" onClick={reset}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Captured photo thumbnails */}
      {!recording && photos.length > 0 && (
        <div className="photos-gallery" style={{ marginTop: '20px' }}>
          <h3>Captured Photos</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {photos.map((photo, i) => (
              <img
                key={i}
                src={photo.image}
                alt={`Photo ${i + 1}`}
                width="140"
                height="auto"
                style={{
                  border: '2px solid #333',
                  borderRadius: '6px',
                  objectFit: 'cover',
                  cursor: 'default',
                }}
                title={`Lat: ${photo.lat !== null ? photo.lat.toFixed(6) : 'Unknown'}\nLon: ${
                  photo.lon !== null ? photo.lon.toFixed(6) : 'Unknown'
                }\nTime (IST): ${photo.time}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Recorder;
