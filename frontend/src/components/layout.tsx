import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.tsx";

const Layout = ()=>{
    return (
        <div className="h-screen w-screen relative flex overflow-hidden">
            <Sidebar />
            <main className="z-20 absolute h-screen left-1/6 top-0 w-[calc(100%-1/6)]">
                <Outlet />
            </main>
        </div>
    )
}

export default Layout;