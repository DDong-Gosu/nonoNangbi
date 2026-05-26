// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "Mongi",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "Mongi",
            path: "Mongi"
        )
    ]
)
