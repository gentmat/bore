cargo build --release --workspace
cargo install --path bore-client
cargo install --path bore-server
export PATH="$HOME/.cargo/bin:$PATH"
for fish
set -Ux fish_user_paths $HOME/.cargo/bin $fish_user_paths



as test

bore-server --bind-addr 127.0.0.1 \
            --bind-tunnels 127.0.0.1 \
            --backend-url http://127.0.0.1:4000


---------------------------------------------------------------
Client
bore 8080 --to 127.0.0.1 --secret sk_test_local
---------------------------------------------------------------

