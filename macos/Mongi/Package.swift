// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "Mongi",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .target(
            name: "MongiCore",
            path: "MongiCore"
        ),
        .executableTarget(
            name: "Mongi",
            dependencies: ["MongiCore"],
            path: "Mongi"
        ),
        .testTarget(
            name: "MongiCoreTests",
            dependencies: ["MongiCore"],
            path: "MongiCoreTests"
        )
    ]
)
