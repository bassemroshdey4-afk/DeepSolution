import { NextPageContext } from 'next';
import Link from 'next/link';

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
  const is404 = statusCode === 404;
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${is404 ? 'bg-blue-100' : 'bg-red-100'}`}>
          <span className={`text-4xl font-bold ${is404 ? 'text-blue-600' : 'text-red-600'}`}>
            {statusCode || '؟'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          {is404 ? 'الصفحة غير موجودة' : 'حدث خطأ'}
        </h1>
        <p className="text-gray-600 mb-8">
          {is404
            ? 'عذراً، الصفحة التي تبحث عنها غير موجودة.'
            : 'عذراً، حدث خطأ غير متوقع.'}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          العودة للوحة التحكم
        </Link>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
