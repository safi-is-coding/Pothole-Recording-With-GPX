
export const generateGPX = (locations) => {
  const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="PotholeApp" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Pothole Path</name>
    <trkseg>`;

  const gpxPoints = locations
    .map(
      (point) => `
    <trkpt lat="${point.lat}" lon="${point.lon}">
      <time>${point.time}</time>
    </trkpt>`
    )
    .join('');

  const gpxFooter = `
  </trkseg>
  </trk>
</gpx>`;

  return gpxHeader + gpxPoints + gpxFooter;
};

