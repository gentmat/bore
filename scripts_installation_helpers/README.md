# Installation Helper Scripts

## Quick Start

```bash
cd scripts_installation_helpers
chmod +x *.sh
```

```bash
./1_install_dependencies.sh
```

```bash
./2_setup_environment.sh
```

```bash
./3_start_services.sh
```

```bash
./4_verify_installation.sh
```

```bash
./5_stop_services.sh
```

```bash
./6_reset_database.sh
```

```bash
./7_view_logs.sh
```

```bash
./8_configure_firewall.sh
```

```bash
./9_build_client.sh
```

```bash
./10_build_gui.sh
```

```bash
./11_uninstall_code_server.sh
```

## Scripts

| Script | Description |
|--------|-------------|
| `1_install_dependencies.sh` | Install Docker, docker-compose, git |
| `2_setup_environment.sh` | Configure .env with secure secrets |
| `3_start_services.sh` | Build and start Docker containers |
| `4_verify_installation.sh` | Check all services are running |
| `5_stop_services.sh` | Stop all containers |
| `6_reset_database.sh` | Delete all data and restart fresh |
| `7_view_logs.sh` | View container logs |
| `8_configure_firewall.sh` | Open required ports |
| `9_build_client.sh` | Build and install bore CLI client |

## Full Install (one-liner)

```bash
./1_install_dependencies.sh && ./2_setup_environment.sh && ./3_start_services.sh && ./4_verify_installation.sh
```
