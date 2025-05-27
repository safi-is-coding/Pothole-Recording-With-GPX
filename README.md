# 🕳️ Pothole Recording and Reporting Web App

A web-based application designed to help users report road potholes by recording **videos**, **capturing GPS-tagged photos**, and saving **GPX location data**, all automatically bundled into a downloadable **ZIP file**. The app simplifies data collection for road maintenance agencies, local governments, and civil engineers by providing geo-contextual evidence of road conditions.

---

## 📌 Project Description

This application allows users to:
- Record **videos** of potholes on the road.
- Simultaneously **capture GPS coordinates** during the video recording.
- Automatically take **snapshots** (photos) during the recording session with embedded GPS location metadata.
- Save **GPX files** containing the full GPS track.
- Package all files (video, photo(s), GPX) into a **ZIP archive** for download and reporting.

It is intended to be used as a **field data collection tool**, particularly by government bodies, contractors, or citizens aiming to report poor road conditions efficiently.

---

## 🚀 Features

- 🎥 **Video Recording** of the pothole environment.
- 📍 **Live Location Tracking** before and during recording.
- 📷 **Snapshot Capture** while video is recording (with GPS metadata).
- 🗺️ **GPX File Generation** for geolocation trace.
- 📦 **ZIP Packaging** of:
  - `.mp4` video
  - `.jpg` image(s)
  - `.gpx` location track
- 💾 **One-click ZIP Download** for easy submission or archival.
- ⚙️ **Location and Camera Permissions** handled gracefully.

---

## 🧰 Tech Stack

- **HTML**, **CSS**, **JavaScript**
- **MediaRecorder API** (for video)
- **Geolocation API** (for GPS)
- **JSZip** (for zipping files)
- **FileSaver.js** (for downloads)
- Deployed on **Vercel**

---

# 🔧 How It Works

* ✅ **App asks for location and camera permissions.**

* 📍 **On permission grant, GPS tracking begins.**

* 🎮 **User clicks "Start Recording":**

  * Starts video recording.
  * Captures GPS coordinates every few seconds.
  * Takes snapshots at intervals.

* ⏹️ **On "Stop Recording":**

  * Stops video and GPS tracking.
  * Generates a `.gpx` file from collected coordinates.
  * Compiles all data into a `.zip` file.

* ⬇️ **User clicks "Download ZIP" to save the report.**

---

# 📲 Demo

👉 **https://pothole-recording-app.vercel.app/**

---

# 🔒 Permissions Required

* 🎥 **Camera** (for recording video and taking pictures)
* 📍 **Geolocation** (to embed and track location in files)

---

# 📁 Output ZIP Contents

```plaintext
pothole-report.zip
🌎 pothole-video.mp4         # Recorded video
📷 pothole-photo.jpg         # Snapshot with GPS metadata
🗺️ location-track.gpx        # GPX track of the recording session
```

---

# 💡 Use Cases

* Road infrastructure surveys
* Citizen pothole reporting
* Government inspection tools
* Construction quality checks
