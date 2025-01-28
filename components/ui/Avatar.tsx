import Image from "next/image";
import React from "react";
import { FaUserCircle } from "react-icons/fa";

const Avatar = ({ src }: { src?: string }) => {
  return src ? <Image src={src} width={40} height={40} alt="Avatar" className="rounded-full" /> : <FaUserCircle size={24} />;
};

export default Avatar;
