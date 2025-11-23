import { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = "http://127.0.0.1:8000/api";

function App() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState("");
  const [view, setView] = useState('register'); // Default View
  
  // Data
  const [patients, setPatients] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  
  // Inputs
  const [chatInput, setChatInput] = useState("");
  const [consultID, setConsultID] = useState("");
  const [consultNote, setConsultNote] = useState("");
  const [safetyResult, setSafetyResult] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([{ role: 'bot', text: "Hello. Please provide Patient Name, Gender, Age, and Phone to register." }]);

  // Auth
  const [lUser, setLUser] = useState(""); const [lPass, setLPass] = useState("");

  // --- 1. LOGIN ---
  const login = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/login/`, { username: lUser, password: lPass });
      setToken(res.data.token);
      setUsername(res.data.username);
      refreshDirectory(res.data.token);
    } catch (e) { alert("Login Failed"); }
  };

  // --- 2. DIRECTORY ---
  const refreshDirectory = async (t) => {
    try {
      const res = await axios.get(`${API_URL}/patients/`, { headers: { 'Authorization': `Token ${t || token}` } });
      setPatients(res.data);
    } catch(e) { console.error("Directory Error"); }
  };

  // --- 3. OPEN FILE (SAFE MODE) ---
  const openFile = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/patients/${id}/file/`, { headers: { 'Authorization': `Token ${token}` } });
      if (res.data && res.data.profile) {
          setActiveFile(res.data);
          setView('file');
      } else {
          alert("File is empty or corrupt.");
      }
    } catch (e) { alert("Error opening file."); }
    setLoading(false);
  };

  // --- 4. DELETE ---
  const deleteFile = async () => {
    if(!window.confirm("⚠ Delete this record?")) return;
    try {
      await axios.delete(`${API_URL}/patients/${activeFile.profile.id}/file/`, { headers: { 'Authorization': `Token ${token}` } });
      alert("Deleted.");
      refreshDirectory();
      setView('directory');
    } catch(e) { alert("Delete failed."); }
  };

  // --- 5. AI REGISTER ---
  const registerPatient = async () => {
    if (!chatInput) return;
    const newH = [...chatHistory, { role: 'user', text: chatInput }];
    setChatHistory(newH);
    setChatInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/ai/action/`, { prompt: chatInput }, { headers: { 'Authorization': `Token ${token}` } });

      if (res.data.type === 'enroll') {
         setChatHistory([...newH, { role: 'bot', text: `✅ Success! ID: ${res.data.id}. Opening File...` }]);
         refreshDirectory();
         await openFile(res.data.id);
      } else {
         setChatHistory([...newH, { role: 'bot', text: "❌ Could not register. Please try again." }]);
      }
    } catch (e) {
      setChatHistory([...newH, { role: 'bot', text: "❌ Connection Error." }]);
    }
    setLoading(false);
  };

  // --- 6. CONSULTATION ---
  const runConsultation = async () => {
    if (!consultID || !consultNote) return alert("Enter Patient ID and Prescription.");
    setLoading(true);
    
    try {
      const res = await axios.post(`${API_URL}/ai/action/`, 
        { prompt: consultNote, patient_id: consultID }, 
        { headers: { 'Authorization': `Token ${token}` } }
      );

      setSafetyResult(res.data.safety);
      
      if (res.data.type === 'emr') {
          // Success - Ask to view file
          if (window.confirm("✅ Processed. View Patient File?")) {
              openFile(consultID);
          }
      }
    } catch (e) { alert("Consultation Error."); }
    setLoading(false);
  };

  if (!token) return <div className="login-wrap"><div className="login-box"><h1>🏥 Dorra Enterprise</h1><form onSubmit={login}><input onChange={e=>setLUser(e.target.value)} placeholder="User"/><input type="password" onChange={e=>setLPass(e.target.value)} placeholder="Pass"/><button>Login</button></form></div></div>;

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="logo">⚡ Dorra EMR</div>
        
        <div className={`menu-item ${view==='register'?'active':''}`} onClick={()=>setView('register')}>1. Register Patient</div>
        <div className={`menu-item ${view==='directory'?'active':''}`} onClick={()=>setView('directory')}>2. Patient Directory</div>
        <div className={`menu-item ${view==='consult'?'active':''}`} onClick={()=>setView('consult')}>3. Diagnosis & Drugs</div>
        
        {view === 'file' && <div className="menu-item active" style={{borderLeft:'3px solid yellow'}}>📂 Active File</div>}
        
        <div className="user-area">Dr. {username} <button onClick={()=>setToken(null)}>Logout</button></div>
      </nav>

      <main className="workspace">
        {loading && <div className="loading-overlay">Loading...</div>}

        {/* VIEW 1: REGISTER */}
        {view === 'register' && (
          <div className="fade-in center-stage">
            <div className="glass-panel chat-box">
              <h2>👤 Patient Registration</h2>
              <p>Enter details (Name, Age, Gender, Phone, Address).</p>
              <div className="chat-scroll">
                {chatHistory.map((h,i)=><div key={i} className={`msg ${h.role}`}>{h.text}</div>)}
              </div>
              <div className="input-row">
                <input placeholder="Ex: Register Musa, Male, 45, Phone 080..." value={chatInput} onChange={e=>setChatInput(e.target.value)} />
                <button className="btn-primary" onClick={registerPatient} disabled={loading}>REGISTER</button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: DIRECTORY */}
        {view === 'directory' && (
          <div className="fade-in">
            <header><h2>Patient Directory</h2></header>
            <div className="glass-panel">
              <table>
                <thead><tr><th>ID</th><th>Name</th><th>Gender</th><th>Action</th></tr></thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id}>
                      <td>#{p.id}</td><td>{p.first_name} {p.last_name}</td><td>{p.gender}</td>
                      <td><button className="btn-ghost" onClick={()=>openFile(p.id)}>Open File →</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: CONSULT */}
        {view === 'consult' && (
           <div className="fade-in center-stage">
              <div className="glass-panel" style={{maxWidth:'600px', margin:'0 auto'}}>
                 <h2>🩺 Clinical Consultation</h2>
                 <p>Prescribe & Check Safety</p>
                 
                 <label>Patient ID:</label>
                 <input className="modern-input" type="number" placeholder="ID (e.g. 222)" value={consultID} onChange={e=>setConsultID(e.target.value)} />
                 
                 <label style={{marginTop:'15px', display:'block'}}>Prescription:</label>
                 <textarea className="modern-input" style={{height:'120px'}} placeholder="Ex: Prescribing Warfarin and Aspirin." value={consultNote} onChange={e=>setConsultNote(e.target.value)} />
                 
                 <button className="btn-primary full" onClick={runConsultation} disabled={loading}>Prescribe & Verify</button>

                 {safetyResult && (
                   <div className={`alert ${safetyResult.risk}`}>
                      <h3>{safetyResult.risk==='HIGH' ? '🚫 CRITICAL SAFETY ALERT' : '✅ SAFE'}</h3>
                      {safetyResult.risk==='HIGH' && safetyResult.alerts?.map((a,i) => (
                        <div key={i} style={{borderTop:'1px solid #ffcccc', paddingTop:'5px', marginTop:'5px'}}>
                           <strong>Conflict:</strong> {a.drug_a} + {a.drug_b} <br/>
                           <em style={{fontSize:'0.9em'}}>"{a.reason}"</em>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
           </div>
        )}

        {/* VIEW 4: ACTIVE FILE (SAFE MODE) */}
        {view === 'file' && activeFile && activeFile.profile && (
          <div className="fade-in file-view">
            <header>
              <button onClick={()=>setView('directory')}>← Back</button>
              <h2>File: {activeFile.profile.first_name} {activeFile.profile.last_name}</h2>
              <button className="btn-danger" onClick={deleteFile}>Delete File</button>
            </header>

            <div className="file-grid">
              {/* TIMELINE */}
              <div className="glass-panel timeline-panel">
                <h3>📅 History Timeline</h3>
                <div className="timeline">
                  {(!activeFile.timeline || activeFile.timeline.length === 0) ? <p className="empty">No history.</p> : activeFile.timeline.map((enc, i) => (
                    <div key={i} className="timeline-card">
                      <div className="date">{new Date(enc.created_at).toLocaleDateString()}</div>
                      <div className="content">
                         <p>{enc.summary || enc.note || "Consultation Recorded"}</p>
                         {enc.drug_interactions?.length > 0 && <div className="risk-tag">⚠️ Safety Alert</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* MEDS */}
              <div className="glass-panel">
                  <h3>💊 Medications</h3>
                  <ul>
                    {(!activeFile.medications || activeFile.medications.length === 0) ? <li>None.</li> : 
                     activeFile.medications.map((m,i)=><li key={i}>{m.name}</li>)}
                  </ul>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;