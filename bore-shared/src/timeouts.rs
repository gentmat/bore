//! Timeout configuration constants with validation.
//!
//! This module ensures that timeout values maintain correct relationships
//! to prevent race conditions during authentication.

use std::time::Duration;

/// Backend HTTP client timeout for API key validation.
///
/// This is the maximum time the server will wait for the backend API
/// to respond during authentication.
pub const BACKEND_HTTP_TIMEOUT: Duration = Duration::from_secs(5);

/// Client network timeout for initial protocol messages.
///
/// This is the maximum time a client will wait for the server to respond
/// during the initial handshake and authentication.
///
/// CRITICAL CONSTRAINT: This MUST be greater than BACKEND_HTTP_TIMEOUT
/// to allow the server sufficient time to complete backend validation.
pub const NETWORK_TIMEOUT: Duration = Duration::from_secs(10);

/// Validate timeout relationships at compile time.
///
/// This ensures that NETWORK_TIMEOUT > BACKEND_HTTP_TIMEOUT to prevent
/// authentication timeout race conditions.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timeout_relationship() {
        // CRITICAL: Client timeout must exceed backend timeout
        assert!(
            NETWORK_TIMEOUT > BACKEND_HTTP_TIMEOUT,
            "NETWORK_TIMEOUT ({:?}) must be greater than BACKEND_HTTP_TIMEOUT ({:?})",
            NETWORK_TIMEOUT,
            BACKEND_HTTP_TIMEOUT
        );

        // Recommended: At least 2x margin for slow networks/backends
        let recommended_min = BACKEND_HTTP_TIMEOUT * 2;
        assert!(
            NETWORK_TIMEOUT >= recommended_min,
            "NETWORK_TIMEOUT ({:?}) should be at least 2x BACKEND_HTTP_TIMEOUT ({:?}) for safety margin",
            NETWORK_TIMEOUT,
            recommended_min
        );
    }

    #[test]
    fn test_timeout_sanity() {
        // Ensure timeouts are reasonable
        assert!(
            BACKEND_HTTP_TIMEOUT.as_secs() >= 3,
            "BACKEND_HTTP_TIMEOUT should be at least 3s for network reliability"
        );

        assert!(
            NETWORK_TIMEOUT.as_secs() <= 30,
            "NETWORK_TIMEOUT should not exceed 30s for good UX"
        );
    }
}
