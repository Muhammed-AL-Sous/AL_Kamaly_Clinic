import { toast } from "react-toastify";

const notify = (message, type) => {
  const options = {
    autoClose: 2500,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
  };

  switch (type) {
    case "success":
      toast.success(message, options);
      break;
    case "error":
      toast.error(message, options);
      break;
    case "warn":
      toast.warn(message, options);
      break;
    default:
      toast(message, options);
  }
};

export default notify;
