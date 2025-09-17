import React from 'react';
import SharedSidebar from '../components/SharedSidebar';
import SharedHeader from '../components/SharedHeader';
import '../styles/Global.css';
import '../styles/TrainerTeam.css';

// Mock data for trainers
const trainers = [
  { id: 1, name: 'Jason Price', role: 'Admin', email: 'janick_parisian@yahoo.com', imageUrl: 'https://placehold.co/100x100/3f51b5/ffffff?text=JP' },
  { id: 2, name: 'Jukkoe Sisao', role: 'CEO', email: 'sibyl_kozey@gmail.com', imageUrl: 'https://placehold.co/100x100/4caf50/ffffff?text=JS' },
  { id: 3, name: 'Harriet King', role: 'CTO', email: 'nadia_block@hotmail.com', imageUrl: 'https://placehold.co/100x100/ff9800/ffffff?text=HK' },
  { id: 4, name: 'Lenora Benson', role: 'Lead', email: 'fel.wallace@kunde.us', imageUrl: 'https://placehold.co/100x100/f44336/ffffff?text=LB' },
  { id: 5, name: 'Olivia Reese', role: 'Strategist', email: 'kemmer.hattie@cremin.us', imageUrl: 'https://placehold.co/100x100/9c27b0/ffffff?text=OR' },
  { id: 6, name: 'Bertha Valdez', role: 'CEO', email: 'loraine.koeppin@tromp.io', imageUrl: 'https://placehold.co/100x100/673ab7/ffffff?text=BV' },
  { id: 7, name: 'Harriett Payne', role: 'Digital Marketer', email: 'nannie_west@estrella.tv', imageUrl: 'https://placehold.co/100x100/00bcd4/ffffff?text=HP' },
  { id: 8, name: 'George Bryant', role: 'Social Media', email: 'delmer.kling@gmail.com', imageUrl: 'https://placehold.co/100x100/009688/ffffff?text=GB' },
  { id: 9, name: 'Lily French', role: 'Strategist', email: 'lucienne.herman@hotmail.com', imageUrl: 'https://placehold.co/100x100/8bc34a/ffffff?text=LF' },
  { id: 10, name: 'Howard Adkins', role: 'CEO', email: 'wiegand.leonor@herman.us', imageUrl: 'https://placehold.co/100x100/cddc39/ffffff?text=HA' },
  { id: 11, name: 'Earl Bowman', role: 'Digital Marketer', email: 'waino.altenwerth@nicolette.tv', imageUrl: 'https://placehold.co/100x100/ffc107/ffffff?text=EB' },
  { id: 12, name: 'Patrick Padilla', role: 'Social Media', email: 'octavia.niemow@gleichner.net', imageUrl: 'https://placehold.co/100x100/ff5722/ffffff?text=PP' },
];

const TrainerCard = ({ trainer }) => (
  <div className="trainer-card">
    <div className="trainer-image-container">
      <img src={trainer.imageUrl} alt={trainer.name} className="trainer-image" />
    </div>
    <h3 className="trainer-name">{trainer.name}</h3>
    <p className="trainer-role">{trainer.role}</p>
    <p className="trainer-email">{trainer.email}</p>
  </div>
);

const TrainerTeam = () => {
  const profileImage = 'https://placehold.co/40x40/E6E6FA/3f51b5?text=Prof+A';
  const userName = "Prof Andy";
  const userRole = "Administrator";

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
                <TrainerCard key={trainer.id} trainer={trainer} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerTeam;