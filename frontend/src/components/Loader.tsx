import { HiOutlineRefresh } from 'react-icons/hi';

interface LoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Loader({ text = 'Loading...', size = 'md' }: LoaderProps) {
  const sizeClass = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }[size];

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <HiOutlineRefresh className={`${sizeClass} text-blue-600 animate-spin mb-2`} />
      <p className="text-gray-600 font-medium">{text}</p>
    </div>
  );
}

export function SkeletonLoader() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-200 h-20 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export function TableSkeletonLoader() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-gray-200 h-16 rounded animate-pulse" />
      ))}
    </div>
  );
}
