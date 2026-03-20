import { AiOutlineStock } from "react-icons/ai";
import { FaScaleUnbalanced } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { apiService } from "../services/land_price"

const Sidebar = () => {
    const sidebarOptions = [
        {label: "Prediction", icon: <AiOutlineStock /> },
        {label: "Compare", icon: <FaScaleUnbalanced />}
    ]
    const [options, setOptions] = useState<string[]>([])

    
    useEffect(()=>{
        async function getSidebarOptions(){
            const data = await apiService.getSidebarOptions();
            setOptions(data)
        }
        getSidebarOptions();
    })

    return (
        // <div className="h-screen bg-gray-800 max-w-1/6 min-w-16 transition-all ease-in-out hover:w-1/6 duration-300 overflow-hidden top-0 left-0 absolute z-50">
        <div className="h-screen bg-gray-800 max-w-1/6 w-1/6 transition-all ease-in-out duration-300 overflow-hidden top-0 left-0 absolute z-50">
            <div className="flex-column gap-2 w-full relative">
                <div className="whitespace-break-spaces">
                    <div className="text-white font-semibold my-3 mx-2">Taskarinchuta</div>
                </div>
                <hr className="border-gray-600"/>
                { (options.length > 0) && sidebarOptions
                .filter((option)=> options.includes(option.label))
                .map((option, index)=>{
                    return (
                        <div className="flex gap-2 text-lg w-full items-center justify-center bg-black py-2"
                            key = {index}
                        >
                            <span className="text-blue-400">{option.icon}</span> <span className="text-white">{option.label}</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default Sidebar;