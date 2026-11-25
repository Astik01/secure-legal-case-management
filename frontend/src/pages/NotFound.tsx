import { Link } from 'react-router-dom';
import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <EmptyState title="Page not found" description="The page you are looking for does not exist or has moved."
        action={<Link to="/"><Button>Back to home</Button></Link>} />
    </div>
  );
}
