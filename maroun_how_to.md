Be sure the server have nodejs and npm . Docker and docker compose 
Then from the root directory run 
make install
make build
make docker-build
make docker-up

or just make docker-up ( i beleive it will install and build everything).


--------------------------------stop docker--------------------------------
make docker-down
--------------------------------clean--------------------------------
make clean
--------------------------------test--------------------------------
make test
--------------------------------audit--------------------------------
make audit
--------------------------------lint--------------------------------
make lint
--------------------------------format--------------------------------
make format   
--------------------------------coverage--------------------------------
make coverage
--------------------------------integration-tests--------------------------------
make integration-tests
--------------------------------performance-tests--------------------------------
make performance-tests
--------------------------------k8s-deploy--------------------------------
make k8s-deploy
--------------------------------k8s-deploy-prod--------------------------------
make k8s-deploy-prod
--------------------------------k8s-status--------------------------------
make k8s-status
--------------------------------k8s-status-prod--------------------------------
make k8s-status-prod
--------------------------------k8s-cleanup--------------------------------
make k8s-cleanup
--------------------------------k8s-cleanup-prod--------------------------------
make k8s-cleanup-prod
--------------------------------db-migrate--------------------------------
make db-migrate
--------------------------------db-rollback--------------------------------
make db-rollback
--------------------------------db-seed--------------------------------
make db-seed
--------------------------------pre-commit--------------------------------
make pre-commit
--------------------------------monitoring-setup--------------------------------
make monitoring-setup
--------------------------------monitoring-up--------------------------------
make monitoring-up
--------------------------------monitoring-down--------------------------------
make monitoring-down
--------------------------------monitoring-logs--------------------------------
make monitoring-logs
--------------------------------monitoring-status--------------------------------
make monitoring-status
--------------------------------docker-logs--------------------------------
make docker-logs
--------------------------------dev-backend--------------------------------
make dev-backend
--------------------------------dev-server--------------------------------
make dev-server
--------------------------------watch--------------------------------
make watch
--------------------------------help--------------------------------
make help
--------------------------------install--------------------------------
make install

------------------------------------------------------------------------------------------------------

Now Client - bore gui
----------------------------------------------
# GTK/WebKit stack
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.0-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf

# Rust toolchain via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# follow the prompt, then reload cargo env
source "$HOME/.cargo/env"

sudo apt-get update
sudo apt-get install -y pkg-config libsoup2.4-dev libglib2.0-dev


sudo apt-get install -y \
  libatk1.0-dev \
  libcairo2-dev \
  libgdk-pixbuf-2.0-dev \
  libpango1.0-dev

  pkg-config --libs --cflags atk cairo gdk-pixbuf-2.0 pango
  

cd bore-gui
npm install
npx tauri info
npm run tauri build
