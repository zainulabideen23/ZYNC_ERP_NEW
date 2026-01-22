# ZYNC ERP

**ZYNC ERP** is a modern, web-based Enterprise Resource Planning system designed for retail and wholesale businesses. It streamlines operations by integrating Sales (POS), Inventory Management, Purchasing, Accounting, and comprehensive Reporting into a single, user-friendly interface.

![ZYNC ERP Dashboard](https://via.placeholder.com/800x400?text=ZYNC+ERP+Dashboard)

## 🚀 Features

### Core Modules
- **Point of Sale (POS)**: Fast and efficient sales interface with barcode scanning support.
- **Inventory Management**: Real-time stock tracking, low stock alerts, and product categorization.
- **Purchase Management**: Manage suppliers, purchase orders, and stock receipts.
- **Accounting**: Automated double-entry bookkeeping, trial balance, and financial statements.
- **Expense Tracking**: Record and categorize operational expenses.
- **User Management**: Role-based access control (Admin, Manager, Cashier) with secure authentication.

### Key Highlights
- **Dynamic Reporting**: Interactive reports for Sales, Stock, Profit & Loss, and Balance Sheet.
- **PDF Invoicing**: Professional, downloadable invoice generation.
- **Modern UI**: Responsive design built with React and custom CSS variables for easy theming.
- **Secure**: JWT-based authentication and BCrypt password hashing.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), React Router, Axios, Date-fns, Recharts (for dashboards).
- **Backend**: Node.js, Express.js.
- **Database**: PostgreSQL (via Knex.js query builder).
- **Authentication**: JSON Web Tokens (JWT).

## ⚙️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [PostgreSQL](https://www.postgresql.org/) (v13 or higher)
- [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/zync-erp.git
cd zync-erp
```

### 2. Backend Setup
Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` folder:
```env
PORT=3001
NODE_ENV=development
DB_HOST=127.0.0.1
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_NAME=zync_erp
JWT_SECRET=your_super_secret_jwt_key
```

Run database migrations and seeds:
```bash
npx knex migrate:latest
npx knex seed:run
```

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
Open a new terminal, navigate to the frontend directory, and install dependencies:
```bash
cd frontend
npm install
```

Start the frontend development server:
```bash
npm run dev
```

Access the application at `http://localhost:5173`.

## 🔑 Default Login
After seeding the database, use the following credentials:

- **Username**: `admin`
- **Password**: `password123`

*(Please change the password immediately after logging in!)*

## 📂 Project Structure

```
zync-erp/
├── backend/            # Express.js API
│   ├── src/
│   │   ├── config/     # DB configuration
│   │   ├── database/   # Migrations & Seeds
│   │   ├── middleware/ # Auth & Error handling
│   │   ├── routes/     # API Endpoints
│   │   └── services/   # Business Logic
├── frontend/           # React Application
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Page views (Sales, Reports, etc.)
│   │   ├── services/   # API integration
│   │   └── store/      # State management (Zustand)
```

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

## 📄 License
This project is licensed under the MIT License.
