import LearningApp from './learning-app';
import { getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath } from './chatgpt-auth';
import Welcome from './welcome';
export const dynamic = 'force-dynamic';
export default async function Page(){const user=await getChatGPTUser();if(!user)return <Welcome signInUrl={chatGPTSignInPath('/')}/>;return <LearningApp account={{id:user.userId,displayName:user.fullName??'Bạn',email:user.email,signOutUrl:chatGPTSignOutPath('/')}}/>;}
