//! Shared library for bore - protocol definitions and utilities
//!
//! This crate contains the core protocol definitions, authentication logic,
//! and utilities shared between the bore client and server.

#![forbid(unsafe_code)]
#![warn(missing_docs)]

pub mod auth;
pub mod protocol;
pub mod timeouts;

// Re-export commonly used items
pub use auth::Authenticator;
pub use protocol::{
    ClientMessage, Delimited, ServerMessage, CONTROL_PORT, MAX_FRAME_LENGTH, NETWORK_TIMEOUT,
};
pub use timeouts::{BACKEND_HTTP_TIMEOUT, NETWORK_TIMEOUT as CLIENT_NETWORK_TIMEOUT};
