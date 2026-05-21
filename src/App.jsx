import React, { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Activity, AlertTriangle, Calendar } from 'lucide-react';
import { fromUrl } from 'geotiff';

// ==========================================
// 1. CONFIGURATION
// ==========================================
// FIX 1: Updated to your exact GitHub username and repository name
const GITHUB_PAGES_BASE_URL = "https://said-sanggabuana.github.io/nanjungmekar-drr-engine";

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [activeOffset, setActiveOffset] = useState(0); 
  const [currentDateString, setCurrentDateString] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [errorLog, setErrorLog] = useState("");

  // ==========================================
  // 2. TEMPORAL LOGIC 
  // ==========================================
  useEffect(() => {
    const today = new Date();
    today.setDate(today.getDate() + activeOffset);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setCurrentDateString(`${yyyy}${mm}${dd}`);
  }, [activeOffset]);

  // ==========================================
  // 3. MAP INITIALIZATION
  // ==========================================
  useEffect(() => {
    if (map.current) return; 

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-base': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-base',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [107.82, -6.97], // Adjusted center closer to Cicalengka
      zoom: 12.5,
      pitch: 45
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      // Add a dummy source with [0,0] coordinates; we will overwrite this dynamically
      map.current.addSource('flood-data', {
        type: 'image',
        url: '', 
        coordinates: [[0,0], [0,0], [0,0], [0,0]]
      });

      map.current.addLayer({
        id: 'flood-layer',
        type: 'raster',
        source: 'flood-data',
        paint: {
          'raster-opacity': 0.7,
          'raster-fade-duration': 500
        }
      });
    });
  }, []);

  // ==========================================
  // 4. THE GEOTIFF CLIENT-SIDE RENDERER
  // ==========================================
  useEffect(() => {
    if (!currentDateString || !map.current) return;
    
    const loadAndRenderGeoTIFF = async () => {
      setIsRendering(true);
      setErrorLog("");
      
      try {
        const offsetLabel = activeOffset < 0 ? `minus${Math.abs(activeOffset)}` : activeOffset > 0 ? `plus${activeOffset}` : 'today';
        const url = `${GITHUB_PAGES_BASE_URL}/cog_flood_${currentDateString}_${offsetLabel}.tif`;

        const tiff = await fromUrl(url);
        const image = await tiff.getImage();
        const rasters = await image.readRasters();
        const data = rasters[0]; 
        
        // FIX 2: Dynamically extract the exact geographic bounds from the TIF file!
        const bbox = image.getBoundingBox();
        const dynamicCoordinates = [
          [bbox[0], bbox[3]], // Top-Left
          [bbox[2], bbox[3]], // Top-Right
          [bbox[2], bbox[1]], // Bottom-Right
          [bbox[0], bbox[1]]  // Bottom-Left
        ];

        const canvas = document.createElement('canvas');
        canvas.width = image.getWidth();
        canvas.height = image.getHeight();
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);

        let hasWater = false;
        for (let i = 0; i < data.length; i++) {
          const depth = data[i];
          if (depth > 0) {
            hasWater = true;
            imageData.data[i * 4] = 59;       
            imageData.data[i * 4 + 1] = 130;  
            imageData.data[i * 4 + 2] = 246;  
            imageData.data[i * 4 + 3] = Math.min(255, depth * 80 + 50); 
          } else {
            imageData.data[i * 4 + 3] = 0;    
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL();

        if (map.current.getSource('flood-data')) {
          map.current.getSource('flood-data').updateImage({
            url: dataUrl,
            coordinates: dynamicCoordinates
          });
        }
        
        if (!hasWater) setErrorLog("Data loaded, but all depths are 0 (dry).");

      } catch (error) {
        console.error("Fetch error:", error);
        setErrorLog("File not found on GitHub. Check URL or wait for Action to finish.");
        
        // Clear the map if data fails
        if (map.current.getSource('flood-data')) {
          map.current.getSource('flood-data').updateImage({
            url: '',
            coordinates: [[0,0], [0,0], [0,0], [0,0]]
          });
        }
      }
      setIsRendering(false);
    };

    if (map.current.isStyleLoaded()) {
      loadAndRenderGeoTIFF();
    } else {
      map.current.once('idle', loadAndRenderGeoTIFF);
    }
  }, [currentDateString, activeOffset]);

  // ==========================================
  // 5. DASHBOARD UI
  // ==========================================
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: 'white' }}>
      
      {/* SIDEBAR */}
      <div style={{ width: '350px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid #1e293b', zIndex: 10 }}>
        
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity color="#3b82f6" /> DRR Flood Engine
          </h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Cikeruh-Cimande Basin Monitoring</p>
        </div>

        <hr style={{ borderColor: '#1e293b', width: '100%' }} />

        <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16}/> Forecast Timeline
            </span>
            <span style={{ fontSize: '12px', backgroundColor: activeOffset === 0 ? '#3b82f6' : '#475569', padding: '2px 8px', borderRadius: '12px' }}>
              Day {activeOffset > 0 ? `+${activeOffset}` : activeOffset}
            </span>
          </div>
          
          <input 
            type="range" 
            min="-14" 
            max="14" 
            value={activeOffset}
            onChange={(e) => setActiveOffset(parseInt(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px', color: '#94a3b8' }}>
            <span>Hindcast (-14)</span>
            <span>Today</span>
            <span>Forecast (+14)</span>
          </div>
        </div>

        <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', flexGrow: 1 }}>
          <h2 style={{ fontSize: '14px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16}/> Active Layer Status
          </h2>
          <div style={{ fontSize: '12px', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><strong>Target Date:</strong> {currentDateString}</p>
            <p><strong>Source:</strong> Cloud Optimized GeoTIFF</p>
            <p style={{ color: isRendering ? '#facc15' : errorLog ? '#ef4444' : '#4ade80' }}>
              <strong>Status:</strong> {isRendering ? "Fetching Data..." : errorLog ? "Error" : "Rendered"}
            </p>
            {errorLog && <p style={{ color: '#ef4444', fontSize: '10px', marginTop: '4px' }}>{errorLog}</p>}
            <p style={{ wordBreak: 'break-all', color: '#64748b', marginTop: '8px' }}>
              cog_flood_{currentDateString}_{activeOffset < 0 ? `minus${Math.abs(activeOffset)}` : activeOffset > 0 ? `plus${activeOffset}` : 'today'}.tif
            </p>
          </div>
        </div>
      </div>

      {/* MAP CANVAS */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
        
        <div style={{ position: 'absolute', bottom: '24px', left: '24px', backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #334155' }}>
          <AlertTriangle color="#ef4444" size={24} />
          <div>
            <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Risk Status</p>
            <h3 style={{ margin: 0, fontSize: '16px', fontFamily: 'monospace' }}>
              {isRendering ? "Computing..." : "Monitoring"}
            </h3>
          </div>
        </div>
      </div>
    </div>
  );
}