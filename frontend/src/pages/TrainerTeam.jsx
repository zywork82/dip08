import React, { useEffect, useState } from 'react';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import '../styles/Global.css';
import '../styles/TrainerTeam.css';
import axios from 'axios';

const getInitials = (name) => {
  if (!name) return 'A';
  return name.trim()[0].toUpperCase();
};

const TrainerCard = ({ trainer }) => (
  <div className="trainer-card">
    <div className="trainer-image-container">
       <img
        src={
          trainer.imageUrl ||
          `https://placehold.co/100x100/E6E6FA/3f51b5?text=${getInitials(trainer.username)}`
        }
        alt={trainer.username}
        className="trainer-image"
      />
    </div>
    <h3 className="trainer-name">{trainer.username}</h3>
    <p className="trainer-email">{trainer.email}</p>
  </div>
);

const TrainerTeam = () => {
  const [trainers, setTrainers] = useState([]);
  const storedUser = JSON.parse(localStorage.getItem('user'));
  const userName = storedUser?.username || 'User';
  const userEmail = storedUser?.email || 'user@example.com';
  const profileImage = storedUser?.imageUrl 
  || `https://i.pinimg.com/1200x/9e/83/75/9e837528f01cf3f42119c5aeeed1b336.jpg`;


  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const token = localStorage.getItem('token'); // JWT token
        const res = await axios.get('http://localhost:5000/admins/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const adminsWithImages = res.data.map((user) => ({
          ...user,
          imageUrl:
            user.imageUrl ||
            `https://placehold.co/100x100/E6E6FA/3f51b5?text=${getInitials(user.username)}`,
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
          <SharedHeader profileImage={profileImage} userName={userName} userEmail={userEmail} />
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
