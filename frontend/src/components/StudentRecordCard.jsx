import React from 'react';

const StudentRecordCard = ({ student }) => {
  return (
    <div className="student-card">
      <div className="student-info">
        <img src={student.profileImg} alt={student.name} />
        <div>
          <p className="student-name">{student.name}</p>
          <p className="student-role">{student.role}</p>
        </div>
      </div>
      <div className="student-completion">
        <p>Completed on {student.completedDate}</p>
        <i className="icon-arrow"></i>
      </div>
    </div>
  );
};

export default StudentRecordCard;