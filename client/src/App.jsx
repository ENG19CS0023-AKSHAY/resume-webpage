import React, { useState } from 'react'
import {
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  Globe,
  Layout,
  Palette,
  ChevronRight,
  ArrowLeft,
  Github,
  Linkedin,
  Mail
} from 'lucide-react'

const App = () => {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const [resumeData, setResumeData] = useState({
    name: 'Alex Rivera',
    role: 'Senior Product Designer',
    bio: 'Passionate about building human-centered digital experiences with over 8 years of experience in SaaS and E-commerce.',
    skills: ['React', 'Next.js', 'Tailwind CSS', 'Figma', 'Node.js'],
    experience: [
      { company: 'TechCorp', role: 'Lead Designer', period: '2021 - Present' },
      { company: 'CreativeFlow', role: 'UI Architect', period: '2018 - 2021' }
    ]
  })

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0]
    if (!uploadedFile) return
    uploadAndParse(uploadedFile)
  }

  const onDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (!droppedFile) return
    uploadAndParse(droppedFile)
  }

  // simple fallback extractors when LLM doesn't provide structured JSON
  const fallbackExtract = (text) => {
    const out = {}
    if (!text) return out
    // email
    const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
    if (emailMatch) out.email = emailMatch[0]
    // phone (simple)
    const phoneMatch = text.match(/(\+?\d[\d\s()-]{6,}\d)/)
    if (phoneMatch) out.phone = phoneMatch[0]
    // name: take first line with letters, not containing @ or phone
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    if (lines.length) {
      const possible = lines.find(l => !l.includes('@') && !/\d/.test(l) && l.split(' ').length <= 4)
      if (possible) out.name = possible
    }
    return out
  }

  const uploadAndParse = async (fileToUpload) => {
    setFile(fileToUpload)
    setStep(2)
    const fd = new FormData()
    fd.append('resume', fileToUpload)

    // Try relative /upload first; if fails, retry localhost:3000
    const tryUrls = ['/upload', 'http://localhost:3000/upload']
    let resp = null
    let lastErr = null
    for (const url of tryUrls) {
      try {
        // recreate FormData for each attempt (fetch may consume body)
        const fd2 = new FormData()
        fd2.append('resume', fileToUpload)
        resp = await fetch(url, { method: 'POST', body: fd2 })
        if (resp && resp.ok) break
      } catch (e) {
        lastErr = e
      }
    }

    if (!resp) {
      console.error('Upload failed', lastErr)
      setStep(1)
      return
    }

    if (!resp.ok) {
      const err = await resp.json().catch(()=>({ error: resp.statusText }))
      console.error('Server error', err)
      setStep(1)
      return
    }

    const data = await resp.json().catch(() => null)
    const parsed = data?.parsed || {}

    // If parsed is a wrapper { raw: '...' } or a string, handle that
    let parsedObj = parsed
    if (typeof parsed === 'string') {
      try { parsedObj = JSON.parse(parsed) } catch { parsedObj = { raw: parsed } }
    }
    if (parsedObj && parsedObj.raw && typeof parsedObj.raw === 'string') {
      // try to parse JSON inside raw
      try {
        parsedObj = JSON.parse(parsedObj.raw)
      } catch {}
    }

    // Map into resumeData with safe defaults and fallbacks
    const rawText = data?.rawText || ''
    const fallback = fallbackExtract(rawText)

    const newResume = {
      name: parsedObj.name || parsedObj.fullName || fallback.name || resumeData.name,
      role: parsedObj.role || parsedObj.title || resumeData.role,
      bio: parsedObj.summary || parsedObj.bio || '',
      skills: parsedObj.skills || parsedObj.tech || resumeData.skills,
      experience: parsedObj.experience || resumeData.experience,
      contact: {
        email: parsedObj.email || fallback.email || '',
        phone: parsedObj.phone || fallback.phone || ''
      }
    }

    setResumeData(prev => ({ ...prev, ...newResume }))
    setStep(3)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Globe size={18} />
            </div>
            <span>SiteGen<span className="text-indigo-600">.ai</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
            <a href="#" className="hover:text-indigo-600 transition-colors">How it works</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Templates</a>
            <button className="bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-all">
              Sign In
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center mb-12">
          {[1, 2, 3].map((num) => (
            <React.Fragment key={num}>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500 ${
                step >= num ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
              }`}>
                {step > num ? <CheckCircle size={20} /> : num}
              </div>
              {num < 3 && (
                <div className={`w-16 h-1 mx-2 rounded ${step > num ? 'bg-indigo-600' : 'bg-slate-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {step === 1 && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">
              Turn your resume into a <br />
              <span className="text-indigo-600">stunning website</span> in seconds.
            </h1>
            <p className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto">
              Upload your PDF or Word document. Our AI will parse your experience and build a high-performance portfolio for you.
            </p>

            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`relative group max-w-xl mx-auto border-2 border-dashed rounded-3xl p-12 transition-all duration-300 cursor-pointer overflow-hidden ${
                isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : 'border-slate-300 bg-white hover:border-indigo-400'
              }`}
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileUpload}
              />
              <div className="flex flex-col items-center">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${
                  isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Upload size={32} />
                </div>
                <p className="text-xl font-semibold mb-2">Click or drag your resume here</p>
                <p className="text-sm text-slate-400">PDF, DOC, DOCX up to 10MB</p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <div className="relative mb-8">
              <Loader2 className="w-16 h-16 text-indigo-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText size={20} className="text-indigo-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Analyzing your career path...</h2>
            <div className="w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-indigo-600 animate-progress origin-left"></div>
            </div>
            <div className="mt-8 space-y-2">
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500" /> Extracted personal details
              </p>
              <p className="text-sm text-slate-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Generating sections for Experience
              </p>
              <p className="text-sm text-slate-300 flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block" /> Optimizing for mobile
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in zoom-in-95 duration-500">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setStep(1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <ArrowLeft size={18} />
                  </button>
                  <h3 className="font-bold text-lg">Customize</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Theme Color</label>
                    <div className="flex gap-3">
                      {['bg-indigo-600', 'bg-rose-500', 'bg-emerald-600', 'bg-amber-500', 'bg-slate-900'].map(color => (
                        <button key={color} className={`w-8 h-8 rounded-full ${color} ring-offset-2 hover:ring-2 ring-slate-300 transition-all`} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Layout Style</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="flex items-center gap-2 p-3 border-2 border-indigo-600 bg-indigo-50/50 rounded-xl text-sm font-medium">
                        <Layout size={16} /> Minimalist
                      </button>
                      <button className="flex items-center gap-2 p-3 border-2 border-slate-100 rounded-xl text-sm font-medium text-slate-600 hover:border-slate-200">
                        <Palette size={16} /> Modern Dark
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <button className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                      Launch My Site <ChevronRight size={18} />
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-4 italic">
                      Your site will be live at: <strong>{resumeData.name.toLowerCase().replace(' ', '')}.sitegen.ai</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border-[6px] border-slate-800">
                <div className="bg-slate-800 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="mx-auto bg-slate-700/50 rounded-md px-3 py-1 text-[10px] text-slate-400 font-mono w-1/2 text-center truncate">
                    https://{resumeData.name.toLowerCase().replace(' ', '')}.sitegen.ai
                  </div>
                </div>

                <div className="h-[600px] bg-white overflow-y-auto preview-scrollbar">
                  <section className="px-12 py-20 text-center border-b border-slate-50">
                    <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 font-bold text-2xl border-4 border-white shadow-lg">
                      {resumeData.name.charAt(0)}
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">{resumeData.name}</h1>
                    <p className="text-indigo-600 font-medium text-lg mb-4">{resumeData.role}</p>
                    <p className="text-slate-500 max-w-md mx-auto leading-relaxed">{resumeData.bio}</p>
                    
                    <div className="flex justify-center gap-4 mt-8">
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors">
                        <Linkedin size={18} />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors">
                        <Github size={18} />
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors">
                        <Mail size={18} />
                      </div>
                    </div>
                  </section>

                  <section className="px-12 py-12">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">Core Expertise</h2>
                    <div className="flex flex-wrap justify-center gap-3">
                      {resumeData.skills.map(skill => (
                        <span key={skill} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-bold border border-indigo-100">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="px-12 py-12 bg-slate-50/50">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mb-10">Experience</h2>
                    <div className="space-y-8">
                      {resumeData.experience.map((exp, idx) => (
                        <div key={idx} className="flex gap-6 group">
                          <div className="text-xs font-mono text-slate-400 pt-1 w-24 shrink-0 uppercase tracking-tighter italic">
                            {exp.period}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{exp.role}</h3>
                            <p className="text-sm text-slate-500">{exp.company}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <footer className="p-8 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">© 2024 {resumeData.name} — Built with SiteGen</p>
                  </footer>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes progress {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(0.95); }
        }
        .animate-progress {
          animation: progress 3s ease-out forwards;
        }
        .preview-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .preview-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .preview-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}

export default App
