import React, { useEffect } from "react";
import { useInterview } from "../hooks/useInterview";
import { useNavigate } from "react-router-dom";
import "../style/Reports.scss";

const Reports = () => {
  const { reports, getReports, deleteReport, loading } = useInterview();
  const navigate = useNavigate();

  useEffect(() => {
    getReports();
  }, []);

  return (
    <div className="reports-page">
      <div className="reports-wrapper">
        {/* Navigation & Header */}
        <header className="reports-header">
          <div className="reports-header__nav">
            <button className="nav-btn nav-btn--back" onClick={() => navigate("/")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back to Dashboard</span>
            </button>
            <button className="nav-btn nav-btn--create" onClick={() => navigate("/")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>New Interview Plan</span>
            </button>
          </div>

          <div className="reports-header__title-block">
            <span className="badge badge--reports">History &amp; Analytics</span>
            <h1>Your Interview <span className="highlight">Reports</span></h1>
            <p>Access, view, and manage all your AI-generated interview preparation strategies and roadmaps.</p>
          </div>
        </header>

        {/* Content Area */}
        {loading && (!reports || reports.length === 0) ? (
          <div className="reports-loading">
            <div className="spinner" />
            <p>Loading your interview reports...</p>
          </div>
        ) : reports && reports.length > 0 ? (
          <div className="reports-grid">
            {reports.map((item) => {
              const score = typeof item.matchScore === "number" ? item.matchScore : null;
              const scoreClass = score !== null
                ? score >= 80 ? "high" : score >= 60 ? "mid" : "low"
                : "none";
              const scoreLabel = score !== null
                ? score >= 80 ? "Strong Match" : score >= 60 ? "Moderate Match" : "Needs Prep"
                : "Not Scored";

              return (
                <div key={item._id} className="report-card">
                  <div className="report-card__top">
                    <div className="report-card__role-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                      </svg>
                    </div>
                    <div className="report-card__heading">
                      <h3 className="report-card__title" title={item.title || "Software Engineer"}>
                        {item.title || "Software Engineer"}
                      </h3>
                      <div className="report-card__date">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "Recently generated"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="report-card__metric">
                    <div className="metric-info">
                      <span className="metric-label">Match Score</span>
                      <span className={`score-badge score-badge--${scoreClass}`}>
                        {scoreLabel}
                      </span>
                    </div>
                    <div className="score-display">
                      <span className={`score-value score-value--${scoreClass}`}>
                        {score !== null ? `${score}%` : "--"}
                      </span>
                    </div>
                  </div>

                  <div className="report-card__footer">
                    <button
                      className="view-btn"
                      onClick={() => navigate(`/interview/${item._id}`)}
                    >
                      <span>View Report</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </button>

                    <button
                      className="delete-btn"
                      title="Delete report"
                      onClick={() => {
                        if (window.confirm("Are you sure you want to delete this report?")) {
                          deleteReport(item._id);
                        }
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="reports-empty">
            <div className="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h3>No reports generated yet</h3>
            <p>Paste a job description and upload your resume to generate your first custom AI interview plan.</p>
            <button className="create-first-btn" onClick={() => navigate("/")}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Create Interview Plan</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;