import { useAuth } from "@/contexts/AuthContext";

export function useCanSeeCode() {
  const { user } = useAuth();
  return user?.role === "admin" && localStorage.getItem("mc_demo") !== "true";
}

export default useCanSeeCode;
