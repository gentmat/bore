# bore-client

Client component for [bore](https://github.com/ekzhang/bore) - a simple TCP tunnel.

## Installation

Install the client using cargo:

```bash
cargo install bore-client
```

## Usage

Forward a local port through a tunnel:

```bash
# Forward local port 3000 to bore.pub
bore 3000 --to bore.pub

# Or use the explicit command
bore local 3000 --to bore.pub

# Specify a custom local host
bore 8080 --to bore.pub --local-host 192.168.1.100

# Use authentication
bore 3000 --to bore.pub --secret sk_your_api_key
```

### Environment Variables

- `BORE_LOCAL_PORT` - Default local port to forward
- `BORE_SERVER` - Default server address
- `BORE_SECRET` - API key or shared secret for authentication

## Learn More

See the main [bore repository](https://github.com/ekzhang/bore) for more information.
