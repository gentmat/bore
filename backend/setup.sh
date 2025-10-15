#!/bin/bash

# Bore Backend Setup Script
# Automates PostgreSQL setup and server initialization

set -e

echo "=================================================="
echo "🚀 Bore Backend Setup Script"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL is not installed${NC}"
    echo ""
    echo "Install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "  macOS:         brew install postgresql@15"
    echo "  Windows:       https://www.postgresql.org/download/windows/"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL is installed${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Install Node.js 16+ from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) is installed${NC}"

# Install npm dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env and configure:${NC}"
    echo "  - Database credentials (DB_HOST, DB_USER, DB_PASSWORD)"
    echo "  - JWT secret (JWT_SECRET)"
    echo "  - Optional: Slack webhook (SLACK_WEBHOOK_URL)"
    echo "  - Optional: SendGrid API key (SENDGRID_API_KEY)"
    echo ""
    read -p "Press Enter when ready to continue..."
fi

# Database setup
echo ""
echo "🗄️  Setting up PostgreSQL database..."
echo ""

# Get database credentials from .env
DB_NAME=$(grep DB_NAME .env | cut -d '=' -f2)
DB_USER=$(grep DB_USER .env | cut -d '=' -f2)
DB_PASSWORD=$(grep DB_PASSWORD .env | cut -d '=' -f2)
DB_HOST=$(grep DB_HOST .env | cut -d '=' -f2)

# Default values if not set
DB_NAME=${DB_NAME:-bore_db}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_HOST=${DB_HOST:-localhost}

echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Host: $DB_HOST"
echo ""

# Check if database exists
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${YELLOW}⚠️  Database '$DB_NAME' already exists${NC}"
    read -p "Drop and recreate? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PGPASSWORD=$DB_PASSWORD dropdb -h $DB_HOST -U $DB_USER $DB_NAME
        echo -e "${GREEN}✅ Database dropped${NC}"
        PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -U $DB_USER $DB_NAME
        echo -e "${GREEN}✅ Database created${NC}"
    fi
else
    PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -U $DB_USER $DB_NAME
    echo -e "${GREEN}✅ Database '$DB_NAME' created${NC}"
fi

# Test database connection
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version();" &> /dev/null; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo "Please check your database credentials in .env"
    exit 1
fi

# Ask if user wants to create a demo admin user
echo ""
read -p "Create demo admin user? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "📝 Demo admin credentials:"
    echo "  Email: admin@bore.com"
    echo "  Password: admin123"
    echo "  (Change this in production!)"
    echo ""
fi

# All done!
echo ""
echo "=================================================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo "=================================================="
echo ""
echo "🚀 Start the server with:"
echo "  npm run dev      (development with auto-reload)"
echo "  npm start        (production)"
echo ""
echo "📊 Access the services:"
echo "  Dashboard:  http://localhost:3000/dashboard"
echo "  Health:     http://localhost:3000/health"
echo "  Metrics:    http://localhost:3000/metrics"
echo ""
echo "📚 Read the full documentation:"
echo "  README.md"
echo "  ENHANCEMENT_COMPLETE.md"
echo ""

# Ask if user wants to start the server now
read -p "Start the server now? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    echo "🚀 Starting server..."
    npm run dev
fi
