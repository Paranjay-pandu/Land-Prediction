import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.tsx";

const Layout = ()=>{
    return (
        <div className="h-screen w-screen relative flex overflow-hidden">
            <Sidebar />
            <main className="flex-1 h-full overflow-y-auto bg-slate-900">
                <Outlet />
            </main>
        </div>
    )
}

export default Layout;