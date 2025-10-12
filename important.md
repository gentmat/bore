cargo build --release --workspace
cargo install --path bore-client
cargo install --path bore-server
export PATH="$HOME/.cargo/bin:$PATH"
for fish
set -Ux fish_user_paths $HOME/.cargo/bin $fish_user_paths



as test

bore-server --bind-addr 127.0.0.1 \
            --bind-tunnels 127.0.0.1 \
            --backend-url http://127.0.0.1:3000

and

cd /home/maroun/Documents/bore/backend

~/Documents/bore/backend main*
❯ 
node server.js


Then start code-server

---------------------------------------------------------------
Client
bore 8080 --to 127.0.0.1 --secret temp_token_ves7j
---------------------------------------------------------------



bore-server --bind-addr 127.0.0.1 --bind-tunnels 127.0.0.1 --backend-url http://127.0.0.1:3000


-------------------------
to install appimage and deb ...
cd bore-gui  
./build-installers.sh 