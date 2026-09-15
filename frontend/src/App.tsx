import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TopNav } from "./components/TopNav/TopNav";
import { DashboardPage } from "./pages/DashboardPage/DashboardPage";
import { RemindersPage } from "./pages/RemindersPage/RemindersPage";
import { ReminderForm } from "./components/ReminderForm/ReminderForm";
import { HabitsPage } from "./pages/HabitsPage/HabitsPage";
import { ProjectsPage } from "./pages/ProjectsPage/ProjectsPage";
import { FlashcardsPage } from "./pages/FlashcardsPage/FlashcardsPage";
import { CalendarProvider } from "./context/CalendarContext";
import { HeaderSlotProvider } from "./context/HeaderSlotContext";
import styles from "./App.module.css";

function App() {
  return (
    <BrowserRouter>
      <CalendarProvider>
        <HeaderSlotProvider>
          <div className={styles.layout}>
            <TopNav />
            <main className={styles.content}>
              <Routes>
                <Route path="/" element={<Navigate to="/lembretes" replace />} />
                <Route path="/inicio" element={<DashboardPage />} />
                <Route path="/lembretes" element={<RemindersPage />}>
                  <Route path="novo" element={<ReminderForm />} />
                  <Route path="r/:id" element={<ReminderForm />} />
                </Route>
                <Route path="/habitos" element={<HabitsPage />} />
                <Route path="/projetos" element={<ProjectsPage />} />
                <Route path="/flashcards" element={<FlashcardsPage />} />
              </Routes>
            </main>
          </div>
        </HeaderSlotProvider>
      </CalendarProvider>
    </BrowserRouter>
  );
}

export default App;
