use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    let dest_dir = PathBuf::from(&manifest_dir).join("resources");
    let dest_binary = dest_dir.join("bore-client");

    // Create resources directory first
    fs::create_dir_all(&dest_dir).expect("Failed to create resources directory");

    // Check if we need to build bore-client
    if !dest_binary.exists() || std::env::var("FORCE_BUILD_BORE_CLIENT").is_ok() {
        println!("cargo:rerun-if-changed=../../bore-client");

        let bore_client_path = PathBuf::from(&manifest_dir)
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("bore-client");

        println!("Building bore-client from: {:?}", bore_client_path);

        // Build bore-client in release mode
        let status = Command::new("cargo")
            .arg("build")
            .arg("--release")
            .arg("--manifest-path")
            .arg(bore_client_path.join("Cargo.toml"))
            .status()
            .expect("Failed to build bore-client");

        if !status.success() {
            panic!("Failed to build bore-client");
        }

        // Copy the bore binary to the resources directory (named as bore-client)
        let target_dir = PathBuf::from(&manifest_dir)
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("target")
            .join("release");

        // The binary is named "bore" not "bore-client" (see bore-client/Cargo.toml)
        let src_binary = target_dir.join("bore");

        if src_binary.exists() {
            fs::copy(&src_binary, &dest_binary).expect("Failed to copy bore binary");
            println!("Copied bore binary to {:?}", dest_binary);
        } else {
            panic!(
                "bore binary not found at {:?}. Make sure bore-client builds successfully.",
                src_binary
            );
        }
    } else {
        println!(
            "bore-client binary already exists at {:?}, skipping build",
            dest_binary
        );
    }

    tauri_build::build()
}
