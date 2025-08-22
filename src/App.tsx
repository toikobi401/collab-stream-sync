import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Join from "./pages/Join";
import Room from "./pages/Room";
import NicknameAuth from "./pages/NicknameAuth";
import RoomList from "./pages/RoomList";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<NicknameAuth />} />
          <Route path="/join" element={<Join />} />
          <Route path="/rooms" element={<RoomList />} />
          <Route path="/room/:roomId" element={<Room />} />
          <Route path="/room" element={<Room />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
