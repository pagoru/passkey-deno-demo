import React from 'react';
import 'main.module.scss';
import { createRoot } from 'react-dom/client';
import {App} from "modules/app";

const root = createRoot(document.getElementById('root'));
root.render(<App />);
