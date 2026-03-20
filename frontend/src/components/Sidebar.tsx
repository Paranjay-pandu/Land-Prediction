import { AiOutlineStock } from "react-icons/ai";
import { FaScaleUnbalanced } from "react-icons/fa6";
import { FaHome } from "react-icons/fa";
import { useEffect, useState } from "react";
import { apiService } from "../services/land_price";
import { useNavigate, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AppContext } from "../context/context";

const Sidebar = () => {
    const navigateFunc = useNavigate();
    const location  = useLocation();
    const currentLocation = location.pathname;
    const sidebarOptions = [
        {label: "Home", icon: <FaHome /> },
        {label: "Prediction", icon: <AiOutlineStock /> },
        {label: "Compare", icon: <FaScaleUnbalanced />}
    ]
    const [options, setOptions] = useState<string[]>([])
    const [optionsURLS, setOptionsURLS] = useState<{[key: string]: string}>({})

    const { data, setData } = useContext(AppContext);
    useEffect(()=>{
        console.log("Data from Context in Sidebar:", data);
        setData({sidebar: "This is data from the sidebar component"});
        console.log("Current Location:" , currentLocation)
        async function getSidebarOptions(){
            const data = await apiService.getSidebarOptions();
            const optionsData = Object.keys(data);
            setOptionsURLS(data);
            setOptions(optionsData);
        }
        getSidebarOptions();
    }, [])

    return (
        // <div className="h-screen bg-gray-800 max-w-1/6 min-w-16 transition-all ease-in-out hover:w-1/6 duration-300 overflow-hidden top-0 left-0 absolute z-50">
        <div className="h-screen  bg-slate-950 max-w-1/6 w-1/6 transition-all ease-in-out duration-300 overflow-hidden top-0 left-0">
            <div className="flex-column gap-2 w-full relative">
                <div className="whitespace-break-spaces">
                    <div className="text-xl font-semibold my-3 mx-2 text-indigo-400 tracking-tight">Taskarinchuta</div>
                </div>
                <hr className="border-gray-600 mb-5"/>
                { (options.length > 0) && sidebarOptions
                .filter((option)=> options.includes(option.label))
                .map((option, index)=>{
                    return (
                        <div className={`cursor-pointer flex gap-2 text-lg w-full items-center py-2 px-2 transition-all ease-in-out ${(currentLocation === optionsURLS[option.label])? "bg-indigo-600 text-white shadow-lg": "text-slate-400 hover:bg-slate-900 hover:text-slate-100"}`}
                            key = {index}
                            onClick={()=> navigateFunc(optionsURLS[option.label])}
                        >
                            <span className="text-orange-400">{option.icon}</span> <span className="text-white">{option.label}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Sidebar;