import React, { useEffect, useState } from 'react';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import '../styles/Global.css';
import '../styles/TrainerTeam.css';
import axios from 'axios';

const TrainerCard = ({ trainer }) => (
  <div className="trainer-card">
    <div className="trainer-image-container">
      <img src={trainer.imageUrl || 'https://placehold.co/100x100/E6E6FA/3f51b5?text=A'} 
           alt={trainer.name} 
           className="trainer-image" />
    </div>
    <h3 className="trainer-name">{trainer.name}</h3>
    <p className="trainer-role">{trainer.role}</p>
    <p className="trainer-email">{trainer.email}</p>
  </div>
);

const TrainerTeam = () => {
  const [trainers, setTrainers] = useState([]);
  const profileImage = 'https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A';
  const userName = "Prof Andy";
  const userRole = "admin";

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const token = localStorage.getItem('token'); // JWT token
        const res = await axios.get('http://localhost:8000/users', {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Filter only admin users
        const admins = res.data.filter(user => user.role === 'admin');

        // Optionally add imageUrl if missing
        const adminsWithImages = admins.map((user, i) => ({
          ...user,
          imageUrl: user.imageUrl || `https://placehold.co/100x100/E6E6FA/3f51b5?text=${user.name[0]}`
        }));

        setTrainers(adminsWithImages);
      } catch (err) {
        console.error('Failed to fetch admin users:', err);
      }
    };

    fetchAdmins();
  }, []);

  return (
    <div className="page-container">
      <SharedSidebar />
      <div className="main-content">
        <div className="header">
          <SharedHeader profileImage={profileImage} userName={userName} userRole={userRole} />
        </div>
        <div className="main-content-body">
          <div className="trainer-team-section">
            <h2 className="section-title">Trainer Team</h2>
            <div className="trainer-grid">
              {trainers.map(trainer => (
                <TrainerCard key={trainer._id} trainer={trainer} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerTeam;
