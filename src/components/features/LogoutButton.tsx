import { useNavigate } from 'react-router-dom';
import { handleLogout } from '../../controllers/AuthController';
import { LogoutIcon } from '../ui/MenuIcons';

interface LogoutButtonProps {
  className: string;
  iconClassName: string;
}

export function LogoutButton({ className, iconClassName }: LogoutButtonProps) {
  const navigate = useNavigate();

  async function logout() {
    await handleLogout();
    navigate('/login', { replace: true });
  }

  return (
    <button type="button" onClick={logout} className={className}>
      <LogoutIcon className={iconClassName} />
    </button>
  );
}
