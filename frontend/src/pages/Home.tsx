import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Xcode dark theme token colors
const C = {
  comment:  '#6B8A4E',
  keyword:  '#FC5FA3',
  string:   '#FC6A5D',
  type:     '#5DD8FF',
  func:     '#67B7A4',
  attr:     '#BF8F4D',
  number:   '#D0BF69',
  plain:    '#D4D4D4',
} as const;

// Each entry: [indentLevel, widthFraction, color] or null for blank line.
// Represents real TrekPoint Swift source, token-colored line-by-line.
type CodeLine = null | [number, number, string];

const SWIFT_LINES: CodeLine[] = [
  [0, 0.22, C.keyword],   // import SwiftUI
  [0, 0.20, C.keyword],   // import MapKit
  [0, 0.27, C.keyword],   // import CoreLocation
  null,
  [0, 0.42, C.comment],   // // MARK: - Map View
  null,
  [0, 0.38, C.keyword],   // struct MapView: View {
  [1, 0.68, C.attr],      // @StateObject private var viewModel = MapViewModel()
  [1, 0.62, C.attr],      // @State private var region = MKCoordinateRegion()
  null,
  [1, 0.34, C.keyword],   // var body: some View {
  [2, 0.16, C.type],      // ZStack {
  [3, 0.55, C.func],      // Map(coordinateRegion: $region,
  [4, 0.48, C.plain],     //     showsUserLocation: true,
  [4, 0.65, C.plain],     //     annotationItems: viewModel.waypoints) { waypoint in
  [4, 0.58, C.type],      // MapAnnotation(coordinate: waypoint.coordinate) {
  [5, 0.44, C.func],      //     WaypointPin(waypoint: waypoint)
  [4, 0.03, C.plain],     //     }
  [3, 0.03, C.plain],     // }
  [3, 0.30, C.func],      // .ignoresSafeArea()
  null,
  [2, 0.14, C.type],      // VStack {
  [3, 0.14, C.func],      //     Spacer()
  [3, 0.45, C.func],      //     ControlPanel(viewModel: viewModel)
  [4, 0.18, C.func],      //         .padding()
  [2, 0.03, C.plain],     // }
  [1, 0.03, C.plain],     // }
  [1, 0.22, C.func],      // .onAppear {
  [2, 0.40, C.func],      //     viewModel.startTracking()
  [1, 0.03, C.plain],     // }
  [0, 0.03, C.plain],     // }
  null,
  [0, 0.44, C.comment],   // // MARK: - View Model
  null,
  [0, 0.58, C.keyword],   // final class MapViewModel: ObservableObject {
  [1, 0.58, C.attr],      // @Published var waypoints: [Waypoint] = []
  [1, 0.60, C.attr],      // @Published var userLocation: CLLocation?
  null,
  [1, 0.62, C.keyword],   // private let locationManager = CLLocationManager()
  [1, 0.44, C.keyword],   // private var tileCache = TileCache()
  null,
  [1, 0.34, C.keyword],   // func startTracking() {
  [2, 0.62, C.func],      //     locationManager.requestWhenInUseAuthorization()
  [2, 0.52, C.func],      //     locationManager.startUpdatingLocation()
  [1, 0.03, C.plain],     // }
  null,
  [1, 0.70, C.keyword],   // func cacheRegion(_ region: MKCoordinateRegion) async throws {
  [2, 0.74, C.keyword],   //     let tiles = try await tileCache.prefetch(region: region)
  [2, 0.70, C.string],    //     print("Cached \(tiles.count) tiles for offline use")
  [1, 0.03, C.plain],     // }
  [0, 0.03, C.plain],     // }
  null,
  [0, 0.40, C.comment],   // // MARK: - Models
  null,
  [0, 0.44, C.keyword],   // struct Waypoint: Identifiable {
  [1, 0.28, C.keyword],   //     let id = UUID()
  [1, 0.26, C.keyword],   //     let name: String
  [1, 0.52, C.keyword],   //     let coordinate: CLLocationCoordinate2D
  [1, 0.34, C.keyword],   //     var elevation: Double
  [1, 0.42, C.string],    //     var notes: String = ""
  [0, 0.03, C.plain],     // }
  null,
  [0, 0.36, C.keyword],   // struct Route: Codable {
  [1, 0.24, C.keyword],   //     let id: String
  [1, 0.46, C.keyword],   //     let waypoints: [Waypoint]
  [1, 0.40, C.keyword],   //     var totalDistance: Double
  [1, 0.52, C.keyword],   //     var estimatedDuration: TimeInterval
  [0, 0.03, C.plain],     // }
  null,
  [0, 0.44, C.comment],   // // MARK: - Tile Cache
  null,
  [0, 0.32, C.keyword],   // final class TileCache {
  [1, 0.58, C.keyword],   //     private let fileManager = FileManager.default
  [1, 0.52, C.keyword],   //     private var cachedTiles: Set<TileKey> = []
  null,
  [1, 0.76, C.keyword],   // func prefetch(region: MKCoordinateRegion) async throws -> [Tile] {
  [2, 0.70, C.keyword],   //     let keys = TileKey.keys(for: region, zoomLevels: 10...16)
  [2, 0.80, C.keyword],   //     return try await withThrowingTaskGroup(of: Tile.self) { group in
  [3, 0.34, C.keyword],   //         for key in keys {
  [4, 0.58, C.func],      //             group.addTask { try await self.fetchTile(key) }
  [3, 0.03, C.plain],     //         }
  [3, 0.40, C.keyword],   //         var tiles: [Tile] = []
  [3, 0.50, C.keyword],   //         for try await tile in group {
  [4, 0.34, C.func],      //             tiles.append(tile)
  [4, 0.50, C.func],      //             self.cachedTiles.insert(tile.key)
  [3, 0.03, C.plain],     //         }
  [3, 0.26, C.keyword],   //         return tiles
  [2, 0.03, C.plain],     //     }
  [1, 0.03, C.plain],     // }
  [0, 0.03, C.plain],     // }
  null,
  [0, 0.46, C.comment],   // // MARK: - Location Delegate
  null,
  [0, 0.70, C.keyword],   // extension MapViewModel: CLLocationManagerDelegate {
  [1, 0.72, C.keyword],   //     func locationManager(_ manager: CLLocationManager,
  [2, 0.66, C.plain],     //                          didUpdateLocations locations: [CLLocation]) {
  [2, 0.48, C.keyword],   //         guard let loc = locations.last else { return }
  [2, 0.38, C.attr],      //         userLocation = loc
  [1, 0.03, C.plain],     //     }
  null,
  [1, 0.72, C.keyword],   //     func locationManager(_ manager: CLLocationManager,
  [2, 0.58, C.plain],     //                          didFailWithError error: Error) {
  [2, 0.62, C.string],    //         print("Location error: \(error.localizedDescription)")
  [1, 0.03, C.plain],     //     }
  [0, 0.03, C.plain],     // }
];

const MASK = 'linear-gradient(to right, rgba(0,0,0,0.35) 0%, rgba(0,0,0,1) 12%, rgba(0,0,0,1) 58%, transparent 100%)';

function MinimapBackground() {
  return (
    <div
      className="absolute left-0 top-0 bottom-0 pointer-events-none select-none overflow-hidden"
      style={{ width: '55%', left: '-1.5rem' }}
      aria-hidden
    >
      <div
        className="h-full flex flex-col justify-center gap-[6px] py-10 opacity-[0.065] dark:opacity-[0.085]"
        style={{ maskImage: MASK, WebkitMaskImage: MASK }}
      >
        {SWIFT_LINES.map((line, i) => {
          if (!line) {
            return <div key={i} className="h-[8px] flex-shrink-0" />;
          }
          const [indent, width, color] = line;
          return (
            <div
              key={i}
              className="h-[8px] rounded-sm flex-shrink-0"
              style={{
                marginLeft: `${indent * 16}px`,
                width: `calc(${width * 100}% - ${indent * 16}px)`,
                backgroundColor: color,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const FULL_NAME = 'Jordan';

export default function Home() {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    const start = setTimeout(() => {
      let i = 0;
      const tick = setInterval(() => {
        i++;
        setDisplayed(FULL_NAME.slice(0, i));
        if (i >= FULL_NAME.length) clearInterval(tick);
      }, 75);
      return () => clearInterval(tick);
    }, 200);
    return () => clearTimeout(start);
  }, []);

  return (
    <div className="relative flex-1 flex items-center justify-center overflow-hidden">
      <MinimapBackground />

      <div className="relative z-10 text-center px-4 animate-fade-in">
        <div className="mb-6">
          <h1 className="text-5xl sm:text-6xl font-bold text-xcode-text-light dark:text-xcode-text tracking-tight font-sans">
            {displayed}
            <span className="inline-block w-[3px] h-[0.9em] ml-0.5 mb-[-0.05em] bg-xcode-accent animate-blink align-middle" />
          </h1>
        </div>

        <p className="text-lg text-xcode-muted max-w-md mx-auto leading-relaxed mb-2">
          iOS Developer, tinkerer, open-source advocate.
        </p>
        <p className="text-base text-xcode-muted max-w-md mx-auto leading-relaxed mb-10">
          Computer Science student at WGU with a habit of building things that don't need to exist (custom keyboards, NES emulators, offline hiking apps, etc.). I mostly program in Swift, but I'll pick up whatever the problem calls for.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            to="/projects"
            className="px-6 py-2.5 rounded-lg bg-xcode-accent text-[#1C1C1E] font-medium text-sm hover:bg-xcode-accent/90 transition-colors"
          >
            Projects
          </Link>
          <Link
            to="/blog"
            className="px-6 py-2.5 rounded-lg border border-xcode-border-light dark:border-xcode-border text-xcode-text-light dark:text-xcode-text font-medium text-sm hover:border-xcode-accent/50 hover:text-xcode-accent transition-colors"
          >
            Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
