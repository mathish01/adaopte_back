import express from 'express';
const app = express()
import cors from "cors"

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}))


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import authRoutes from './authentification/authroute' 
import adoptRoutes from './adoption/adoptroute'
import volunteerRoutes from './volunteer/volunteerroute'
import donationRoutes from './donation/donationroute'
import contactRoutes from './contact/contactroute'
import userDashboardRoutes from './userdashboard/userdashboardroute'
import adminDashboardRoutes from './admindashboard/admindashboardroute'
import adminRoutes from './admin/adminroute'
import adminuserRoutes from './adminutilisateur/adminuserroute'

app.use('/api/auth', authRoutes) 
app.use('/api/adopt', adoptRoutes)
app.use ('/api/volunteer', volunteerRoutes)
app.use('/api/donation', donationRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/userdashboard', userDashboardRoutes)
app.use('/api/admindashboard', adminDashboardRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/useradmin', adminuserRoutes)

const port = process.env.PORT || 3005; 



app.listen(port, () => {
  console.log(`Adalicious Backend listening on port ${port}`)
  console.log(`Server running at http://localhost:${port}`)
})