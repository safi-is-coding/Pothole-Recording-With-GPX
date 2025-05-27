import React, { useRef, useState, useEffect } from 'react';
import { generateGPX } from '../utils/gpxHelper';
import '../styles/recorder.css';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

const Recorder = () => {
  const [recording, setRecording] = useState(false);
  const [mediaBlobUrl, setMediaBlobUrl] = useState(null);
  const [locations, setLocations] = useState([]);
  const [photos, setPhotos] = useState([]); // Stores clicked photos with GPS
  const [captureMessage, setCaptureMessage] = useState(''); // Message for photo capture feedback

  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const streamRef = useRef(null);
  const locationWatchId = useRef(null);
  const videoPreviewRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (locationWatchId.current !== null) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, []);

  const startRecording = async () => {
    // Step 1: Ask for location permission first
    navigator.geolocation.getCurrentPosition(
      async (initialPosition) => {
        // ✅ Location access granted - continue with media access
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false,
          });
  
          streamRef.current = stream;
  
          if (videoPreviewRef.current) {
            videoPreviewRef.current.srcObject = stream;
            videoPreviewRef.current.onloadedmetadata = () => {
              videoPreviewRef.current.play().catch((error) => {
                console.warn('Video play was prevented:', error);
              });
            };
          }
  
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
  
          // Start tracking location
          locationWatchId.current = navigator.geolocation.watchPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              const timestamp = new Date().toISOString();
              setLocations((prev) => {
                const last = prev[prev.length - 1];
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
          console.error('Error accessing media devices.', err);
          alert('Please allow camera access and use a secure context (HTTPS).');
        }
      },
      (error) => {
        // ❌ Location permission denied or error
        console.error('Location permission denied:', error);
        alert('Location permission is required to start recording.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };
  
  // Stop recording and return video blob
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
        // Already stopped
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

  // 📸 Take photo and draw GPS coordinates on it + show message
  const capturePhoto = () => {
    if (!videoPreviewRef.current) return;

    // Show capture message immediately for better UX
    setCaptureMessage('Photo captured!');
    setTimeout(() => setCaptureMessage(''), 2000);

    const canvas = document.createElement('canvas');
    canvas.width = videoPreviewRef.current.videoWidth;
    canvas.height = videoPreviewRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoPreviewRef.current, 0, 0, canvas.width, canvas.height);

    // Fetch GPS asynchronously
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

        // Overlay GPS & timestamp on canvas
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, canvas.height - 60, canvas.width - 20, 50);
        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.fillText(`Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)}`, 20, canvas.height - 35);
        ctx.fillText(`Time (IST): ${timestamp}`, 20, canvas.height - 15);

        const imageData = canvas.toDataURL('image/jpeg');

        // Add the photo data with GPS overlay
        setPhotos((prev) => [
          ...prev,
          { image: imageData, lat: latitude, lon: longitude, time: timestamp },
        ]);
      },
      (error) => {
        console.warn('Photo GPS error:', error);

        // If GPS fails, still add photo without GPS overlay
        const imageData = canvas.toDataURL('image/jpeg');
        setPhotos((prev) => [
          ...prev,
          { image: imageData, lat: null, lon: null, time: 'Unknown' },
        ]);
      }
    );
  };

  const saveFiles = async () => {
    let videoBlob;

    if (!mediaBlobUrl) {
      // If recording still going, stop and get blob
      videoBlob = await stopRecording();
    } else {
      // Use recorded chunks to form the blob if available
      if (recordedChunks.current.length > 0) {
        videoBlob = new Blob(recordedChunks.current, { type: 'video/webm' });
      } else {
        videoBlob = null;
      }
    }

    if (!videoBlob) {
      alert('No video recorded to save!');
      return;
    }

    const gpx = generateGPX(locations);
    const gpxBlob = new Blob([gpx], { type: 'application/gpx+xml' });

    const zip = new JSZip();
    zip.file('pothole_video.mp4', videoBlob);
    zip.file('pothole_locations.gpx', gpxBlob);

    // 🗂 Add all captured photos
    photos.forEach((photo, index) => {
      const base64 = photo.image.split(',')[1]; 
      // Safely handle null lat/lon in filename
      const latStr = photo.lat !== null ? photo.lat.toFixed(4) : 'unknownLat';
      const lonStr = photo.lon !== null ? photo.lon.toFixed(4) : 'unknownLon';
      const filename = `photo_${index + 1}_${latStr}_${lonStr}.jpg`;
      zip.file(filename, base64, { base64: true });
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'pothole_report.zip');
  };

  const reset = () => {
    setMediaBlobUrl(null);
    setLocations([]);
    setPhotos([]);
    recordedChunks.current = [];
    setCaptureMessage('');
  };

  return (
    <div className="recorder-container" style={{ position: 'relative' }}>
      <video
        ref={videoPreviewRef}
        width="300"
        muted
        autoPlay
        playsInline
        className={`live-preview ${!recording ? 'hidden' : ''}`}
        style={{ display: recording ? 'block' : 'none' }}
      />

      <h2>{recording ? 'Recording...' : 'Record Pothole'}</h2>

      <button
        className={`record-btn ${recording ? 'stop' : 'start'}`}
        onClick={recording ? stopRecording : startRecording}
      >
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>

      {/* 📸 Photo Capture Button */}
      {recording && (
        <button className="photo-btn" onClick={capturePhoto}>
          Click Photo
        </button>
      )}

      {/* Show capture message */}
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

      {mediaBlobUrl && (
        <div className="preview-section">
          <video src={mediaBlobUrl} controls width="300" />
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

      {/* Show clicked photos with GPS and timestamp overlays, only after recording stopped */}
      {!recording && photos.length > 0 && (
        <div className="photos-gallery" style={{ marginTop: '20px' }}>
          <h3>Captured Photos</h3>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
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







// import React, { useRef, useState, useEffect } from 'react';
// import { generateGPX } from '../utils/gpxHelper';
// import '../styles/recorder.css';
// import JSZip from 'jszip';
// import { saveAs } from 'file-saver';

// const Recorder = () => {
//   const [recording, setRecording] = useState(false);
//   const [mediaBlobUrl, setMediaBlobUrl] = useState(null);
//   const [locations, setLocations] = useState([]);
//   const mediaRecorderRef = useRef(null);
//   const recordedChunks = useRef([]);
//   const streamRef = useRef(null);
//   const locationIntervalRef = useRef(null);
//   const videoPreviewRef = useRef(null);

//   useEffect(() => {
//     return () => {
//       if (streamRef.current) {
//         streamRef.current.getTracks().forEach((track) => track.stop());
//       }
//       clearInterval(locationIntervalRef.current);
//     };
//   }, []);

//   const startRecording = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { facingMode: { ideal: 'environment' } },
//         audio: true,
//       });

//       streamRef.current = stream;

//       if (videoPreviewRef.current) {
//         videoPreviewRef.current.srcObject = stream;
//         videoPreviewRef.current.play().catch(console.warn);
//       }

//       mediaRecorderRef.current = new MediaRecorder(stream);
//       recordedChunks.current = [];

//       mediaRecorderRef.current.ondataavailable = (event) => {
//         if (event.data.size > 0) {
//           recordedChunks.current.push(event.data);
//         }
//       };

//       mediaRecorderRef.current.onstop = () => {
//         const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
//         setMediaBlobUrl(URL.createObjectURL(blob));
//       };

//       mediaRecorderRef.current.start();
//       setRecording(true);
//       setLocations([]);

//       locationIntervalRef.current = setInterval(() => {
//         navigator.geolocation.getCurrentPosition(
//           (pos) => {
//             const { latitude, longitude } = pos.coords;
//             const timestamp = new Date().toISOString();
//             setLocations(prev => [...prev, { lat: latitude, lon: longitude, time: timestamp }]);
//           },
//           (err) => console.warn("GPS Error:", err)
//         );
//       }, 1000);

//     } catch (err) {
//       console.error('Media Error:', err);
//       alert('Please allow camera, microphone, and location access.');
//     }
//   };

//   const stopRecording = () => {
//     if (mediaRecorderRef.current?.state !== 'inactive') {
//       mediaRecorderRef.current.stop();
//     }

//     streamRef.current?.getTracks().forEach(track => track.stop());
//     clearInterval(locationIntervalRef.current);
//     setRecording(false);
//   };

//   const saveAsZip = async () => {
//     const zip = new JSZip();

//     const videoBlob = new Blob(recordedChunks.current, { type: 'video/webm' });
//     const gpxData = generateGPX(locations);
//     const gpxBlob = new Blob([gpxData], { type: 'application/gpx+xml' });

//     zip.file("pothole_video.webm", videoBlob);
//     zip.file("pothole_locations.gpx", gpxBlob);

//     const zipBlob = await zip.generateAsync({ type: "blob" });
//     saveAs(zipBlob, "pothole_report.zip");
//   };

//   const reset = () => {
//     setMediaBlobUrl(null);
//     setLocations([]);
//     recordedChunks.current = [];
//   };

//   return (
//     <div className="recorder-container">
//       {recording && (
//         <video
//           ref={videoPreviewRef}
//           width="300"
//           muted
//           playsInline
//           className="live-preview"
//         />
//       )}

//       <h2>{recording ? "Recording..." : "Pothole Reporting"}</h2>

//       <button
//         className={`record-btn ${recording ? 'stop' : 'start'}`}
//         onClick={recording ? stopRecording : startRecording}
//       >
//         {recording ? 'Stop Recording' : 'Start Recording'}
//       </button>

//       {mediaBlobUrl && (
//         <div className="preview-section">
//           <video src={mediaBlobUrl} controls width="300" />
//           <div className="action-buttons">
//             <button className="save-btn" onClick={saveAsZip}>Download ZIP</button>
//             <button className="reset-btn" onClick={reset}>Reset</button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Recorder;


// import React, { useRef, useState, useEffect } from 'react';
// import { generateGPX } from '../utils/gpxHelper';
// import '../styles/recorder.css';
// import { saveAs } from 'file-saver';
// import JSZip from 'jszip';

// const Recorder = () => {
//   const [recording, setRecording] = useState(false);
//   const [mediaBlobUrl, setMediaBlobUrl] = useState(null);
//   const [locations, setLocations] = useState([]);
//   const [potholes, setPotholes] = useState([]);

//   const mediaRecorderRef = useRef(null);
//   const recordedChunks = useRef([]);
//   const streamRef = useRef(null);
//   const locationWatchId = useRef(null);
//   const videoPreviewRef = useRef(null);

//   useEffect(() => {
//     return () => {
//       if (streamRef.current) {
//         streamRef.current.getTracks().forEach(track => track.stop());
//       }
//       if (locationWatchId.current !== null) {
//         navigator.geolocation.clearWatch(locationWatchId.current);
//       }
//     };
//   }, []);

//   const startRecording = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: { facingMode: 'environment' },
//         audio: false,
//       });

//       streamRef.current = stream;
//       if (videoPreviewRef.current) {
//         videoPreviewRef.current.srcObject = stream;
//         videoPreviewRef.current.onloadedmetadata = () => {
//           videoPreviewRef.current.play().catch(console.warn);
//         };
//       }

//       mediaRecorderRef.current = new MediaRecorder(stream, {
//         mimeType: 'video/webm',
//       });

//       recordedChunks.current = [];
//       mediaRecorderRef.current.ondataavailable = (event) => {
//         if (event.data.size > 0) {
//           recordedChunks.current.push(event.data);
//         }
//       };

//       mediaRecorderRef.current.onstop = () => {
//         const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
//         setMediaBlobUrl(URL.createObjectURL(blob));
//       };

//       mediaRecorderRef.current.start();
//       setRecording(true);
//       setLocations([]);
//       setPotholes([]);

//       locationWatchId.current = navigator.geolocation.watchPosition(
//         (pos) => {
//           const { latitude, longitude } = pos.coords;
//           const timestamp = new Date().toISOString();

//           setLocations((prev) => {
//             const last = prev[prev.length - 1];
//             if (!last || last.lat !== latitude || last.lon !== longitude) {
//               return [...prev, { lat: latitude, lon: longitude, time: timestamp }];
//             }
//             return prev;
//           });
//         },
//         (err) => {
//           console.warn('Geolocation error:', err);
//         },
//         {
//           enableHighAccuracy: true,
//           maximumAge: 1000,
//           timeout: 5000,
//         }
//       );
//     } catch (err) {
//       alert('Please allow camera and location access.');
//       console.error('Media error:', err);
//     }
//   };

//   const stopRecording = () => {
//     return new Promise((resolve) => {
//       if (mediaRecorderRef.current?.state !== 'inactive') {
//         mediaRecorderRef.current.onstop = () => {
//           const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
//           const blobUrl = URL.createObjectURL(blob);
//           setMediaBlobUrl(blobUrl);
//           resolve(blob);
//         };
//         mediaRecorderRef.current.stop();
//       }

//       streamRef.current?.getTracks().forEach(track => track.stop());

//       if (locationWatchId.current !== null) {
//         navigator.geolocation.clearWatch(locationWatchId.current);
//         locationWatchId.current = null;
//       }

//       setRecording(false);
//     });
//   };

//   const saveFiles = async () => {
//     const blob = mediaBlobUrl
//       ? new Blob(recordedChunks.current, { type: 'video/webm' })
//       : await stopRecording();

//     const gpx = generateGPX(locations, potholes);
//     const gpxBlob = new Blob([gpx], { type: 'application/gpx+xml' });

//     const zip = new JSZip();
//     zip.file('pothole_video.webm', blob);
//     zip.file('pothole_locations.gpx', gpxBlob);

//     const zipBlob = await zip.generateAsync({ type: 'blob' });
//     saveAs(zipBlob, 'pothole_report.zip');
//   };

//   const reset = () => {
//     setMediaBlobUrl(null);
//     setLocations([]);
//     setPotholes([]);
//     recordedChunks.current = [];
//   };

//   const handlePotholeTap = () => {
//     if (!recording) return;
//     if (locations.length === 0) return;

//     const latest = locations[locations.length - 1];
//     setPotholes((prev) => [...prev, { ...latest }]);
//     console.log('Pothole marked at:', latest);
//   };

//   return (
//     <div className="recorder-container">
//       <video
//         ref={videoPreviewRef}
//         width="300"
//         muted
//         autoPlay
//         playsInline
//         onClick={handlePotholeTap}
//         className={`live-preview ${!recording ? 'hidden' : ''}`}
//         style={{ display: recording ? 'block' : 'none' }}
//       />

//       <h2>{recording ? 'Recording in Progress' : 'Record Pothole'}</h2>

//       <button
//         className={`record-btn ${recording ? 'stop' : 'start'}`}
//         onClick={recording ? stopRecording : startRecording}
//       >
//         {recording ? 'Stop Recording' : 'Start Recording'}
//       </button>

//       {mediaBlobUrl && (
//         <div className="preview-section">
//           <video src={mediaBlobUrl} controls width="300" />
//           <div className="action-buttons">
//             <button className="save-btn" onClick={saveFiles}>Download</button>
//             <button className="reset-btn" onClick={reset}>Reset</button>
//           </div>
//           <p style={{ fontSize: '0.9em', color: '#777' }}>
//             Download ZIP (video + GPX with pothole markers)
//           </p>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Recorder;
